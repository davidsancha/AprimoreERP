package com.aprimoreegf.erp

import android.net.Uri
import android.view.LayoutInflater
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide

/** Grade de miniaturas com seleção múltipla — Glide cuida do cache/reciclagem pra rolar liso mesmo com muitas fotos. */
class PhotoAdapter(private val onSelecaoMudou: (List<Uri>) -> Unit) : RecyclerView.Adapter<PhotoAdapter.ViewHolder>() {

    private val itens = mutableListOf<Uri>()
    private val ordemSelecao = mutableListOf<Uri>()

    fun definirItens(novos: List<Uri>) {
        itens.clear()
        itens.addAll(novos)
        ordemSelecao.clear()
        notifyDataSetChanged()
    }

    fun itensSelecionados(): List<Uri> = ordemSelecao.toList()

    class ViewHolder(view: FrameLayout) : RecyclerView.ViewHolder(view) {
        val imagem: ImageView = view.findViewById(R.id.imgThumb)
        val overlay: android.view.View = view.findViewById(R.id.viewOverlay)
        val badge: TextView = view.findViewById(R.id.textBadge)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_photo, parent, false) as FrameLayout
        return ViewHolder(view)
    }

    override fun getItemCount() = itens.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val uri = itens[position]
        Glide.with(holder.imagem.context)
            .load(uri)
            .centerCrop()
            .into(holder.imagem)

        val indiceSelecao = ordemSelecao.indexOf(uri)
        val selecionado = indiceSelecao >= 0
        holder.overlay.visibility = if (selecionado) android.view.View.VISIBLE else android.view.View.GONE
        holder.badge.visibility = if (selecionado) android.view.View.VISIBLE else android.view.View.GONE
        if (selecionado) holder.badge.text = (indiceSelecao + 1).toString()

        holder.itemView.setOnClickListener {
            if (selecionado) {
                ordemSelecao.remove(uri)
            } else {
                ordemSelecao.add(uri)
            }
            notifyDataSetChanged()
            onSelecaoMudou(ordemSelecao)
        }
    }
}
