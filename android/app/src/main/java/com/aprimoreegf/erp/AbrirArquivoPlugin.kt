package com.aprimoreegf.erp

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

/**
 * Abre um arquivo já salvo no aparelho via Intent.ACTION_VIEW — usado pra
 * disparar a instalação do APK de atualização assim que o download termina,
 * em vez de só avisar "abra o arquivo pra instalar" e deixar o usuário
 * caçar o arquivo no gerenciador de arquivos (ver VerificadorAtualizacaoApp.tsx).
 * Content:// via FileProvider porque Android 7+ bloqueia file:// entre apps.
 */
@CapacitorPlugin(name = "AbrirArquivo")
class AbrirArquivoPlugin : Plugin() {

    @PluginMethod
    fun abrir(call: PluginCall) {
        val caminho = call.getString("path")
        val mimeType = call.getString("mimeType") ?: "*/*"

        if (caminho.isNullOrBlank()) {
            call.reject("Caminho do arquivo não informado")
            return
        }

        try {
            val arquivo = File(caminho)
            if (!arquivo.exists()) {
                call.reject("Arquivo não encontrado: $caminho")
                return
            }

            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                arquivo
            )

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mimeType)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            activity.startActivity(intent)
            call.resolve(JSObject())
        } catch (e: Exception) {
            call.reject("Não foi possível abrir o arquivo: ${e.message}")
        }
    }
}
