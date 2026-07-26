package org.mytonwallet.app_air.uicomponents.commonViews

import android.graphics.Color
import org.mytonwallet.app_air.uicomponents.R

enum class CardBackground(
    val id: String,
    val label: String,
    val imageRes: Int,
    val primaryTextColor: Int = Color.WHITE,
    val secondaryTextColor: Int = Color.argb(191, 255, 255, 255),
) {
    DEFAULT("default", "Yohi Wallet", R.drawable.img_card_default),
    ORANGE("orange", "Blue", R.drawable.img_card_blue),
    GREEN("green", "Green", R.drawable.img_card_green),
    SEA("sea", "Ocean", R.drawable.img_card_sea),
    PURPLE("purple", "Purple", R.drawable.img_card_purple),
    PINK("pink", "Pink", R.drawable.img_card_pink),
    RED("red", "Red", R.drawable.img_card_red);

    companion object {
        fun fromId(id: String?): CardBackground {
            return entries.firstOrNull { it.id == id } ?: DEFAULT
        }
    }
}
