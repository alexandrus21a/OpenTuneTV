package com.opentunern.newpipe

/** Ported from com.opentune.innertube.InnertubeModels (same project). */
data class ShelfItem(
    val title: String,
    val subtitle: String,
    val thumbnailUrl: String?,
    val videoId: String?,
    val browseId: String?,
)

data class HomeShelf(
    val title: String,
    val items: List<ShelfItem>,
    val subtitle: String = "",
)
