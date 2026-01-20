package com.danesha.pos;

import android.os.Bundle;
import android.app.Activity;
import android.content.Context;
import android.view.View;
import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KioskPlugin.class);
        super.onCreate(savedInstanceState);
        checkAndRequestBluetoothPermissions();
    }

    private void checkAndRequestBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ArrayList<String> permissions = new ArrayList<>();
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.BLUETOOTH_CONNECT);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.BLUETOOTH_SCAN);
            }

            if (!permissions.isEmpty()) {
                ActivityCompat.requestPermissions(this, permissions.toArray(new String[0]), 1001);
            }
        }
    }

    @CapacitorPlugin(name = "KioskMode")
    public static class KioskPlugin extends Plugin {
        @PluginMethod
        public void startLockTask(PluginCall call) {
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().startLockTask();
                    call.resolve();
                } catch (Exception e) {
                    call.reject("Failed to start lock task: " + e.getMessage());
                }
            });
        }

        @PluginMethod
        public void stopLockTask(PluginCall call) {
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().stopLockTask();
                    call.resolve();
                } catch (Exception e) {
                    call.reject("Failed to stop lock task: " + e.getMessage());
                }
            });
        }

        @PluginMethod
        public void isInLockTaskMode(PluginCall call) {
            // Checking actual lock task state is a bit complex across versions,
            // but for simplicity we can just resolve successfully or track it.
            // For now, let's just resolve.
            call.resolve();
        }
    }
}
