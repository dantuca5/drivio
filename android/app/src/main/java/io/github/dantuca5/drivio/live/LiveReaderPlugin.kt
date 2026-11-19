package io.github.dantuca5.drivio.live

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import android.util.Base64
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

/** Puntea dintre ecranul de Setări din Drivio și serviciul de accesibilitate. */
@CapacitorPlugin(name = "LiveReader")
class LiveReaderPlugin : Plugin() {

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val ctx = context
        val stats = LiveSettings.store(ctx).stats()
        val ret = JSObject()
        ret.put("serviceEnabled", isServiceEnabled())
        ret.put("captureEnabled", LiveSettings.captureEnabled(ctx))
        ret.put("captures", stats.snapshots)
        ret.put("bytes", stats.bytes)
        ret.put("uberInstalled", isInstalled("com.ubercab.driver"))
        ret.put("boltInstalled", isInstalled("ee.mtakso.driver"))
        call.resolve(ret)
    }

    @PluginMethod
    fun openAccessibilitySettings(call: PluginCall) {
        start(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        call.resolve()
    }

    /** Informațiile aplicației: de aici se permit „setările restricționate” (meniul ⋮). */
    @PluginMethod
    fun openAppDetails(call: PluginCall) {
        start(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + context.packageName)))
        call.resolve()
    }

    @PluginMethod
    fun openBatterySettings(call: PluginCall) {
        start(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        call.resolve()
    }

    @PluginMethod
    fun setCaptureEnabled(call: PluginCall) {
        LiveSettings.setCaptureEnabled(context, call.getBoolean("enabled") ?: false)
        call.resolve()
    }

    @PluginMethod
    fun shareCaptures(call: PluginCall) {
        val store = LiveSettings.store(context)
        if (store.files().isEmpty()) {
            call.reject("Nu există înregistrări.")
            return
        }
        val out = store.mergeTo(File(context.cacheDir, "partajare/drivio-capturi.jsonl"))
        share(out, "text/plain", "Trimite înregistrările")
        call.resolve()
    }

    @PluginMethod
    fun clearCaptures(call: PluginCall) {
        LiveSettings.store(context).clear()
        call.resolve()
    }

    /** Partajarea unui fișier creat de aplicație (backup, PDF, CSV): WebView-ul nu are foaia de partajare. */
    @PluginMethod
    fun shareFile(call: PluginCall) {
        val name = call.getString("name")?.replace(Regex("[^A-Za-z0-9._-]"), "_")
        val data = call.getString("data")
        if (name.isNullOrEmpty() || data == null) {
            call.reject("Lipsește fișierul.")
            return
        }
        val out = File(context.cacheDir, "partajare/$name")
        out.parentFile?.mkdirs()
        out.writeBytes(Base64.decode(data, Base64.DEFAULT))
        share(out, call.getString("mime") ?: "application/octet-stream", "Salvează sau trimite")
        call.resolve()
    }

    private fun share(file: File, mime: String, title: String) {
        val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
        val send = Intent(Intent.ACTION_SEND)
            .setType(mime)
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        start(Intent.createChooser(send, title))
    }

    private fun start(intent: Intent) {
        val act = activity
        if (act != null) act.startActivity(intent) else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun isServiceEnabled(): Boolean {
        val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: return false
        val me = ComponentName(context, DrivioAccessibilityService::class.java)
        return enabled.split(':').any { ComponentName.unflattenFromString(it) == me }
    }

    private fun isInstalled(pkg: String): Boolean = context.packageManager.getLaunchIntentForPackage(pkg) != null
}
