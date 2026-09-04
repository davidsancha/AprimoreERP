package com.aprimoreegf.erp

import android.net.Uri
import android.view.LayoutInflater
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide

/** Grade de miniaturas com seleção única — tocar numa foto já escolhe ela (sem confirmação separada). Glide cuida do cache/reciclagem pra rolar liso mesmo com muitas fotos. */
class PhotoAdapter(private val onFotoEscolhida: (Uri) -> Unit) : RecyclerView.Adapter<PhotoAdapter.ViewHolder>() {

    private val itens = mutableListOf<Uri>()

    fun definirItens(novos: List<Uri>) {
        itens.clear()
        itens.addAll(novos)
        notifyDataSetChanged()
    }

    class ViewHolder(view: FrameLayout) : RecyclerView.ViewHolder(view) {
        val imagem: ImageView = view.findViewById(R.id.imgThumb)
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

        holder.itemView.setOnClickListener { onFotoEscolhida(uri) }
    }
}
