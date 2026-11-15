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
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.view.inputmethod.EditorInfo;

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
        String saved = prefs.getString("server", "https://sashaweb-o1lws0zt.back4.app");
        openServer(saved);
    }

    private void askServer() {
        final EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setHint("https://ваш-сервер.example");
        input.setInputType( android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        new AlertDialog.Builder(this)
            .setTitle("Подключение IGROgram")
            .setMessage("Введите адрес опубликованного сервера. Например: https://example.onrender.com")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Подключить", (dialog, which) -> {
                String url = input.getText().toString().trim();
                if (!url.startsWith("https://")) {
                    Toast.makeText(this, "Нужен адрес, начинающийся с https://", Toast.LENGTH_LONG).show();
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
        if (!url.endsWith("/igrogram")) url += "/igrogram";
        web.loadUrl(url + "/");
    }

    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
