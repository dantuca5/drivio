package io.github.dantuca5.drivio.live

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.io.File
import java.util.concurrent.Executors

/** Aplicațiile de șofer urmărite (pachetele se confirmă din înregistrări). */
val WATCHED_PACKAGES = setOf("com.ubercab.driver", "ee.mtakso.driver")

/**
 * Pasul 0: serviciul doar CITEȘTE ecranele Uber Driver și Bolt Driver și, dacă șoferul a pornit
 * înregistrarea, le salvează pe telefon cu datele personale ascunse. Nu apasă nimic și nu trimite nimic.
 */
class DrivioAccessibilityService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    private var pending = false
    private var lastCaptureAt = 0L
    private val lastSignature = HashMap<String, Int>()
    private lateinit var store: CaptureStore

    private val capture = Runnable {
        pending = false
        captureNow()
    }

    override fun onServiceConnected() {
        store = LiveSettings.store(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val pkg = event?.packageName?.toString() ?: return
        if (pkg !in WATCHED_PACKAGES || !LiveSettings.captureEnabled(this)) return
        if (pending) return
        pending = true
        handler.postDelayed(capture, Throttle.delayMs(SystemClock.uptimeMillis(), lastCaptureAt))
    }

    private fun captureNow() {
        lastCaptureAt = SystemClock.uptimeMillis()
        val roots = windows.mapNotNull { it.root }.ifEmpty { listOfNotNull(rootInActiveWindow) }
        val now = System.currentTimeMillis()
        for (root in roots) {
            val pkg = root.packageName?.toString() ?: continue
            if (pkg !in WATCHED_PACKAGES) continue
            val nodes = Snapshot.redacted(flatten(root))
            if (nodes.isEmpty()) continue
            val sig = Snapshot.signature(nodes)
            if (lastSignature[pkg] == sig) continue
            lastSignature[pkg] = sig
            val line = Snapshot.toJsonLine(pkg, now, nodes)
            io.execute { runCatching { store.append(line, now) } }
        }
    }

    private fun flatten(root: AccessibilityNodeInfo): List<ScreenNode> {
        val out = ArrayList<ScreenNode>()
        val stack = ArrayDeque<Pair<AccessibilityNodeInfo, Int>>()
        stack.addLast(root to 0)
        val rect = Rect()
        while (stack.isNotEmpty() && out.size < MAX_NODES) {
            val (n, depth) = stack.removeLast()
            if (!n.isVisibleToUser) continue
            val text = n.text?.toString()
            val desc = n.contentDescription?.toString()
            if (!text.isNullOrBlank() || !desc.isNullOrBlank()) {
                n.getBoundsInScreen(rect)
                out.add(ScreenNode(text, desc, n.viewIdResourceName, n.className?.toString(), rect.left, rect.top, rect.right, rect.bottom))
            }
            if (depth < MAX_DEPTH) {
                for (i in n.childCount - 1 downTo 0) n.getChild(i)?.let { stack.addLast(it to depth + 1) }
            }
        }
        return out
    }

    override fun onInterrupt() {
        handler.removeCallbacks(capture)
        pending = false
    }

    override fun onDestroy() {
        handler.removeCallbacks(capture)
        io.shutdown()
        super.onDestroy()
    }

    private companion object {
        const val MAX_NODES = 400
        const val MAX_DEPTH = 40
    }
}

/** Setările citirii automate, comune serviciului și aplicației. */
object LiveSettings {
    private const val PREFS = "drivio_live"
    private const val KEY_CAPTURE = "capture_enabled"

    fun captureEnabled(ctx: Context): Boolean =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_CAPTURE, false)

    fun setCaptureEnabled(ctx: Context, enabled: Boolean) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_CAPTURE, enabled).apply()
    }

    fun store(ctx: Context) = CaptureStore(File(ctx.filesDir, "capturi"))
}
