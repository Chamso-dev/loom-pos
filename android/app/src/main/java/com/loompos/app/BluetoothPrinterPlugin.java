package com.loompos.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;

/**
 * Minimal classic-Bluetooth (SPP/RFCOMM) printer bridge for ESC/POS thermal
 * receipt printers. The web layer builds the ESC/POS byte stream and hands it
 * here as base64; this plugin opens an RFCOMM socket to a paired device and
 * writes the bytes. Most consumer thermal printers speak classic SPP rather
 * than BLE, which is why this uses RFCOMM directly instead of a BLE plugin.
 */
@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class BluetoothPrinterPlugin extends Plugin {

    // Standard Serial Port Profile UUID used by ESC/POS thermal printers.
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        JSObject ret = new JSObject();
        ret.put("available", adapter != null);
        ret.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        if (needsBluetoothPermission()) {
            requestPermissionForAlias("bluetooth", call, "permissionCallback");
            return;
        }
        deliverPairedDevices(call);
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (needsBluetoothPermission()) {
            requestPermissionForAlias("bluetooth", call, "permissionCallback");
            return;
        }
        doPrint(call);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (needsBluetoothPermission()) {
            call.reject("Bluetooth permission was not granted");
            return;
        }
        if ("print".equals(call.getMethodName())) {
            doPrint(call);
        } else {
            deliverPairedDevices(call);
        }
    }

    private boolean needsBluetoothPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return false; // BLUETOOTH_CONNECT runtime grant only exists on Android 12+.
        }
        return getContext().checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
            != PackageManager.PERMISSION_GRANTED;
    }

    private void deliverPairedDevices(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("Bluetooth is not available on this device");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth is turned off");
            return;
        }

        JSArray devices = new JSArray();
        try {
            Set<BluetoothDevice> paired = adapter.getBondedDevices();
            for (BluetoothDevice device : paired) {
                JSObject entry = new JSObject();
                String name = device.getName();
                entry.put("name", name != null ? name : "Unknown device");
                entry.put("address", device.getAddress());
                devices.put(entry);
            }
        } catch (SecurityException e) {
            call.reject("Missing Bluetooth permission");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("devices", devices);
        call.resolve(ret);
    }

    private void doPrint(PluginCall call) {
        String address = call.getString("address");
        String data = call.getString("data");
        if (address == null || address.isEmpty()) {
            call.reject("A printer address is required");
            return;
        }
        if (data == null || data.isEmpty()) {
            call.reject("No data to print");
            return;
        }

        final byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Print data is not valid base64");
            return;
        }

        // Networking/IO off the main thread.
        new Thread(() -> {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Bluetooth is not available on this device");
                return;
            }

            BluetoothSocket socket = null;
            try {
                BluetoothDevice device = adapter.getRemoteDevice(address);
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                adapter.cancelDiscovery(); // Discovery slows down / blocks connect().
                socket.connect();

                OutputStream out = socket.getOutputStream();
                out.write(bytes);
                out.flush();
                // Give the printer time to drain its buffer before we close.
                try {
                    Thread.sleep(400);
                } catch (InterruptedException ignored) {
                }
                out.close();

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (SecurityException e) {
                call.reject("Missing Bluetooth permission");
            } catch (Exception e) {
                call.reject("Could not print: " + e.getMessage());
            } finally {
                if (socket != null) {
                    try {
                        socket.close();
                    } catch (Exception ignored) {
                    }
                }
            }
        }).start();
    }
}
