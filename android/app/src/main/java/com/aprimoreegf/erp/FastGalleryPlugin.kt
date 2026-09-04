package com.aprimoreegf.erp

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream

/**
 * Seletor de fotos nativo estilo WhatsApp: abre direto na pasta da câmera
 * (DCIM/Camera), grade rápida com Glide, seleção múltipla — em vez do
 * seletor de arquivos genérico do Android (lento, sem pasta padrão).
 * Ver FastGalleryActivity para a grade em si.
 */
@CapacitorPlugin(name = "FastGallery")
class FastGalleryPlugin : Plugin() {

    @PluginMethod
    fun pick(call: PluginCall) {
        val intent = Intent(activity, FastGalleryActivity::class.java)
        saveCall(call)
        startActivityForResult(call, intent, "pickResult")
    }

    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.handleOnActivityResult(requestCode, resultCode, data)
        val call = savedCall ?: return

        if (resultCode != Activity.RESULT_OK || data == null) {
            call.reject("Seleção cancelada")
            return
        }

        val uris = data.getStringArrayListExtra(FastGalleryActivity.EXTRA_RESULT_URIS) ?: arrayListOf()
        // Copia pro cache do app: content:// dos itens de mídia some fora do
        // ciclo de vida da picker em alguns fabricantes, e o lado JS precisa
        // de um File real pro pipeline de upload existente (uploadFotoRelatorio).
        val cacheDir = File(context.cacheDir, "fast-gallery").apply { mkdirs() }
        val result = JSArray()

        for ((index, uriStr) in uris.withIndex()) {
            try {
                val uri = Uri.parse(uriStr)
                val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                val ext = if (mime.contains("png")) "png" else if (mime.contains("webp")) "webp" else "jpg"
                val outFile = File(cacheDir, "foto-${System.currentTimeMillis()}-$index.$ext")
                context.contentResolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(outFile).use { output -> input.copyTo(output) }
                }
                val item = JSObject()
                item.put("path", outFile.absolutePath)
                item.put("name", outFile.name)
                item.put("mimeType", mime)
                result.put(item)
            } catch (e: Exception) {
                // ignora essa foto e segue com as demais — melhor devolver
                // parte da seleção do que falhar tudo por um item problemático
            }
        }

        val ret = JSObject()
        ret.put("photos", result)
        call.resolve(ret)
    }
}
