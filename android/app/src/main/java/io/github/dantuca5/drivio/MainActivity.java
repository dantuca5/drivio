package io.github.dantuca5.drivio;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.github.dantuca5.drivio.live.LiveReaderPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LiveReaderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
