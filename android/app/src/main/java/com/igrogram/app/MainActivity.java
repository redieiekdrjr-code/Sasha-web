package com.igrogram.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.Toast;
import android.content.SharedPreferences;
import android.view.ViewGroup;

public class MainActivity extends Activity {
    private WebView web;
    private SharedPreferences prefs;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("igrogram", MODE_PRIVATE);
        web = new WebView(this);
        web.setLayoutParams(new ViewGroup.LayoutParams(-1, -1));
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setDatabaseEnabled(true);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        setContentView(web);
        String saved = prefs.getString("server", null);
        if (saved == null) askServer(); else openServer(saved);
    }

    private void askServer() {
        final EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setHint("https://igrogram.<поддомен>.workers.dev");
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        new AlertDialog.Builder(this)
            .setTitle("Подключение IGROgram")
            .setMessage("Введите постоянный адрес Cloudflare Workers после публикации.")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Подключить", (dialog, which) -> {
                String url = input.getText().toString().trim();
                if (!url.startsWith("https://") || !url.endsWith("workers.dev")) {
                    Toast.makeText(this, "Введите HTTPS-адрес workers.dev", Toast.LENGTH_LONG).show();
                    askServer();
                    return;
                }
                prefs.edit().putString("server", url.replaceAll("/+$", "")).apply();
                openServer(url);
            })
            .setNegativeButton("Отмена", (dialog, which) -> finish())
            .show();
    }

    private void openServer(String base) {
        String url = base.replaceAll("/+$", "");
        web.loadUrl(url + "/igrogram/");
    }

    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
