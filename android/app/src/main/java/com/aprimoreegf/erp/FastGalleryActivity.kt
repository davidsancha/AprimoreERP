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
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView

/** Uma pasta/álbum de fotos do aparelho — `bucketId == null` representa "Todas as fotos" (agregado, sem filtro). */
private data class Album(val bucketId: String?, val nome: String, val quantidade: Int)

/**
 * Grade nativa de fotos, estilo WhatsApp: abre direto em DCIM/Camera (a
 * pasta que a própria câmera do aparelho grava), com um seletor de álbum
 * em dropdown no topo — igual ao da picker de mídia do WhatsApp — pra
 * trocar pra qualquer outra pasta (Todas as fotos, Downloads, capturas de
 * tela etc.), não só um botão fixo "Câmera ↔ Todas". Sem SAF/Intent
 * genérico — consulta MediaStore direto, então abre e rola instantaneamente.
 * Seleção única: tocar numa foto já escolhe e fecha a tela, sem passo de
 * confirmação separado (ver PhotoAdapter).
 */
class FastGalleryActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_RESULT_URIS = "resultUris"
        private const val PERMISSAO_REQUEST_CODE = 9001
        private const val BUCKET_CAMERA = "Camera"
    }

    private lateinit var recyclerView: RecyclerView
    private lateinit var trocarAlbumView: TextView
    private lateinit var adapter: PhotoAdapter

    // null = ainda não resolvido (primeiro carregamento tenta achar "Camera"); "" seria ambíguo com um bucketId de verdade, por isso Album.bucketId usa null pra "todas as fotos"
    private var albumAtual: Album? = null
    private var albuns: List<Album> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_fast_gallery)

        recyclerView = findViewById(R.id.recyclerFotos)
        trocarAlbumView = findViewById(R.id.textTrocarAlbum)

        findViewById<TextView>(R.id.textCancelar).setOnClickListener {
            setResult(RESULT_CANCELED)
            finish()
        }

        // seleção única — tocar na foto já escolhe e fecha a tela na hora, sem confirmação separada
        adapter = PhotoAdapter { uri ->
            val resultIntent = Intent()
            resultIntent.putStringArrayListExtra(EXTRA_RESULT_URIS, arrayListOf(uri.toString()))
            setResult(RESULT_OK, resultIntent)
            finish()
        }
        recyclerView.layoutManager = GridLayoutManager(this, 3)
        recyclerView.adapter = adapter

        trocarAlbumView.setOnClickListener { abrirSeletorDeAlbum() }

        pedirPermissaoECarregar()
    }

    /**
     * Android 14+ (API 34) tem um terceiro estado além de permitir/negar: o
     * usuário pode conceder acesso PARCIAL ("selecionar fotos"), que não
     * marca READ_MEDIA_IMAGES como concedida — só READ_MEDIA_VISUAL_USER_SELECTED.
     * Sem pedir as duas, esse caso caía direto no "permissão negada" mesmo
     * com o usuário tendo liberado alguma coisa.
     */
    private fun permissoesNecessarias(): Array<String> {
        return when {
            Build.VERSION.SDK_INT >= 34 -> arrayOf(Manifest.permission.READ_MEDIA_IMAGES, "android.permission.READ_MEDIA_VISUAL_USER_SELECTED")
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> arrayOf(Manifest.permission.READ_MEDIA_IMAGES)
            else -> arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    private fun algumaPermissaoConcedida(): Boolean {
        return permissoesNecessarias().any { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }
    }

    private fun pedirPermissaoECarregar() {
        if (algumaPermissaoConcedida()) {
            carregarAlbunsECarregarFotos()
        } else {
            ActivityCompat.requestPermissions(this, permissoesNecessarias(), PERMISSAO_REQUEST_CODE)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSAO_REQUEST_CODE) {
            if (grantResults.any { it == PackageManager.PERMISSION_GRANTED }) {
                carregarAlbunsECarregarFotos()
            } else {
                Toast.makeText(this, "Permissão de fotos negada.", Toast.LENGTH_SHORT).show()
                setResult(RESULT_CANCELED)
                finish()
            }
        }
    }

    /** Lista todos os álbuns (pastas) com fotos, mais "Todas as fotos" agregando tudo — igual ao dropdown do WhatsApp. */
    private fun listarAlbuns(): List<Album> {
        val colecao = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val projecao = arrayOf(MediaStore.Images.Media.BUCKET_ID, MediaStore.Images.Media.BUCKET_DISPLAY_NAME)
        val porBucket = LinkedHashMap<String, Pair<String, Int>>()
        var total = 0

        contentResolver.query(colecao, projecao, null, null, null)?.use { cursor ->
            val idIdx = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.BUCKET_ID)
            val nomeIdx = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)
            while (cursor.moveToNext()) {
                val bucketId = cursor.getString(idIdx) ?: continue
                val nome = cursor.getString(nomeIdx) ?: "Sem nome"
                val atual = porBucket[bucketId]
                porBucket[bucketId] = nome to ((atual?.second ?: 0) + 1)
                total++
            }
        }

        val lista = mutableListOf(Album(null, "Todas as fotos", total))
        lista += porBucket.entries
            .map { (id, par) -> Album(id, par.first, par.second) }
            .sortedByDescending { it.quantidade }
        return lista
    }

    private fun carregarAlbunsECarregarFotos() {
        albuns = listarAlbuns()
        // padrão: abre direto no álbum da câmera (mesma pasta que o app de
        // câmera do aparelho grava) — se não achar (fabricante usa outro
        // nome, ou aparelho sem fotos de câmera ainda), cai pra "Todas as fotos"
        albumAtual = albuns.firstOrNull { it.nome.equals(BUCKET_CAMERA, ignoreCase = true) } ?: albuns.firstOrNull()
        carregarFotos()
    }

    private fun abrirSeletorDeAlbum() {
        if (albuns.isEmpty()) return
        val nomes = albuns.map { "${it.nome} (${it.quantidade})" }.toTypedArray()
        val indiceAtual = albuns.indexOfFirst { it.bucketId == albumAtual?.bucketId }.coerceAtLeast(0)
        AlertDialog.Builder(this)
            .setTitle("Escolher álbum")
            .setSingleChoiceItems(nomes, indiceAtual) { dialog, posicao ->
                albumAtual = albuns[posicao]
                carregarFotos()
                dialog.dismiss()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun carregarFotos() {
        val album = albumAtual ?: return
        val fotos = consultarMediaStore(album.bucketId)
        adapter.definirItens(fotos)
        trocarAlbumView.text = "${album.nome} ▾"
    }

    private fun consultarMediaStore(bucketId: String?): List<Uri> {
        val colecao = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val projecao = arrayOf(MediaStore.Images.Media._ID)
        val selecao = if (bucketId != null) "${MediaStore.Images.Media.BUCKET_ID} = ?" else null
        val selecaoArgs = if (bucketId != null) arrayOf(bucketId) else null
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
}
