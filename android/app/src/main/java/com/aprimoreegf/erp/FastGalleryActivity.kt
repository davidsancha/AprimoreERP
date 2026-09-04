package com.aprimoreegf.erp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView

/**
 * Grade nativa de fotos, estilo WhatsApp: abre direto em DCIM/Camera (a
 * pasta que a própria câmera do aparelho grava), com botão pra alternar
 * pra "Todas as fotos" quando o usuário quiser. Sem SAF/Intent genérico —
 * consulta MediaStore direto, então abre e rola instantaneamente.
 */
class FastGalleryActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_RESULT_URIS = "resultUris"
        private const val PERMISSAO_REQUEST_CODE = 9001
        private const val BUCKET_CAMERA = "Camera"
    }

    private lateinit var recyclerView: RecyclerView
    private lateinit var tituloView: TextView
    private lateinit var confirmarView: TextView
    private lateinit var trocarAlbumView: TextView
    private lateinit var adapter: PhotoAdapter
    private var somenteCamera = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_fast_gallery)

        recyclerView = findViewById(R.id.recyclerFotos)
        tituloView = findViewById(R.id.textTitulo)
        confirmarView = findViewById(R.id.textConfirmar)
        trocarAlbumView = findViewById(R.id.textTrocarAlbum)

        findViewById<TextView>(R.id.textCancelar).setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }

        adapter = PhotoAdapter { selecionados -> atualizarConfirmar(selecionados) }
        recyclerView.layoutManager = GridLayoutManager(this, 3)
        recyclerView.adapter = adapter

        confirmarView.setOnClickListener {
            val uris = ArrayList(adapter.itensSelecionados().map { it.toString() })
            val resultIntent = Intent()
            resultIntent.putStringArrayListExtra(EXTRA_RESULT_URIS, uris)
            setResult(RESULT_OK, resultIntent)
            finish()
        }

        trocarAlbumView.setOnClickListener {
            somenteCamera = !somenteCamera
            carregarFotos()
        }

        pedirPermissaoECarregar()
    }

    private fun permissaoNecessaria(): String {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_IMAGES
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }
    }

    private fun pedirPermissaoECarregar() {
        val permissao = permissaoNecessaria()
        if (ContextCompat.checkSelfPermission(this, permissao) == PackageManager.PERMISSION_GRANTED) {
            carregarFotos()
        } else {
            ActivityCompat.requestPermissions(this, arrayOf(permissao), PERMISSAO_REQUEST_CODE)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSAO_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                carregarFotos()
            } else {
                Toast.makeText(this, "Permissão de fotos negada.", Toast.LENGTH_SHORT).show()
                setResult(RESULT_CANCELED)
                finish()
            }
        }
    }

    private fun carregarFotos() {
        val fotos = consultarMediaStore(somenteCamera)
        // Fallback: se o dispositivo não tem uma pasta "Camera" identificável
        // (alguns fabricantes usam outro nome), não deixa a tela em branco —
        // cai direto pra "todas as fotos" sem o usuário precisar descobrir isso.
        if (fotos.isEmpty() && somenteCamera) {
            somenteCamera = false
            carregarFotos()
            return
        }
        adapter.definirItens(fotos)
        tituloView.text = if (somenteCamera) "Câmera" else "Todas as fotos"
        trocarAlbumView.text = if (somenteCamera) "Todas as fotos" else "Câmera"
        atualizarConfirmar(adapter.itensSelecionados())
    }

    private fun consultarMediaStore(apenasCamera: Boolean): List<Uri> {
        val colecao = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val projecao = arrayOf(MediaStore.Images.Media._ID)
        val selecao = if (apenasCamera) "${MediaStore.Images.Media.BUCKET_DISPLAY_NAME} = ?" else null
        val selecaoArgs = if (apenasCamera) arrayOf(BUCKET_CAMERA) else null
        val ordenacao = "${MediaStore.Images.Media.DATE_ADDED} DESC"

        val lista = mutableListOf<Uri>()
        contentResolver.query(colecao, projecao, selecao, selecaoArgs, ordenacao)?.use { cursor ->
            val idColuna = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
            while (cursor.moveToNext()) {
                val id = cursor.getLong(idColuna)
                lista.add(Uri.withAppendedPath(colecao, id.toString()))
            }
        }
        return lista
    }

    private fun atualizarConfirmar(selecionados: List<Uri>) {
        confirmarView.isEnabled = selecionados.isNotEmpty()
        confirmarView.alpha = if (selecionados.isEmpty()) 0.4f else 1f
        confirmarView.text = if (selecionados.isEmpty()) "Escolher" else "Escolher (${selecionados.size})"
    }
}
