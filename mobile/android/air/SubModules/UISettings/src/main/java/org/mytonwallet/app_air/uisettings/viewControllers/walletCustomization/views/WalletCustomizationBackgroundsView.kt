package org.mytonwallet.app_air.uisettings.viewControllers.walletCustomization.views

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.appcompat.widget.AppCompatImageView
import org.mytonwallet.app_air.uicomponents.commonViews.CardBackground
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.helpers.adaptiveFontSize
import org.mytonwallet.app_air.uicomponents.widgets.WLabel
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.walletbasecontext.localization.LocaleController
import org.mytonwallet.app_air.walletbasecontext.theme.ViewConstants
import org.mytonwallet.app_air.walletbasecontext.theme.WColor
import org.mytonwallet.app_air.walletbasecontext.theme.color

@SuppressLint("ViewConstructor")
class WalletCustomizationBackgroundsView(context: Context) :
    LinearLayout(context), WThemedView {

    var onBackgroundSelected: ((CardBackground) -> Unit)? = null

    private val titleLabel = WLabel(context).apply {
        setStyle(adaptiveFontSize())
        text = LocaleController.getString("Background")
        gravity = Gravity.START or Gravity.CENTER_VERTICAL
        setPadding(20.dp, 0, 20.dp, 0)
    }

    private val itemViews = CardBackground.entries.map { cardBackground ->
        CardBackgroundItemView(context, cardBackground).apply {
            setOnClickListener {
                onBackgroundSelected?.invoke(cardBackground)
            }
        }
    }

    init {
        orientation = VERTICAL
        addView(titleLabel, LayoutParams(MATCH_PARENT, 48.dp))

        itemViews.chunked(COLUMN_COUNT).forEach { rowItems ->
            addView(LinearLayout(context).apply {
                orientation = HORIZONTAL
                rowItems.forEach { itemView ->
                    addView(itemView, LayoutParams(0, ITEM_HEIGHT_DP.dp, 1f).apply {
                        marginStart = 4.dp
                        marginEnd = 4.dp
                    })
                }
                repeat(COLUMN_COUNT - rowItems.size) {
                    addView(FrameLayout(context), LayoutParams(0, ITEM_HEIGHT_DP.dp, 1f).apply {
                        marginStart = 4.dp
                        marginEnd = 4.dp
                    })
                }
            }, LayoutParams(MATCH_PARENT, ITEM_HEIGHT_DP.dp).apply {
                leftMargin = 12.dp
                rightMargin = 12.dp
                bottomMargin = 8.dp
            })
        }

        setPadding(0, 0, 0, 8.dp)
        updateTheme()
    }

    fun configure(selectedBackground: CardBackground) {
        itemViews.forEach { itemView ->
            itemView.isSelectedBackground = itemView.cardBackground == selectedBackground
        }
    }

    override fun updateTheme() {
        setBackgroundColor(WColor.Background.color, ViewConstants.BLOCK_RADIUS.dp)
        titleLabel.setTextColor(WColor.Tint)
        itemViews.forEach { it.updateTheme() }
    }

    companion object {
        private const val COLUMN_COUNT = 4
        private const val ITEM_HEIGHT_DP = 58
    }
}

@SuppressLint("ViewConstructor")
private class CardBackgroundItemView(
    context: Context,
    val cardBackground: CardBackground,
) : FrameLayout(context), WThemedView {

    var isSelectedBackground = false
        set(value) {
            field = value
            val padding = if (value) 3.dp else 2.dp
            setPadding(padding, padding, padding, padding)
            invalidate()
        }

    private val imageView = AppCompatImageView(context).apply {
        setImageResource(cardBackground.imageRes)
        scaleType = ImageView.ScaleType.CENTER_CROP
    }

    private val titleLabel = WLabel(context).apply {
        setStyle(11f)
        text = cardBackground.label
        setTextColor(cardBackground.primaryTextColor)
    }

    init {
        addView(imageView, LayoutParams(MATCH_PARENT, MATCH_PARENT))
        addView(titleLabel, LayoutParams(WRAP_CONTENT, WRAP_CONTENT).apply {
            gravity = Gravity.START or Gravity.TOP
            marginStart = 8.dp
            topMargin = 7.dp
        })
        clipToOutline = true
        updateTheme()
    }

    override fun updateTheme() {
        setBackgroundColor(Color.TRANSPARENT, 8f.dp, true)
        invalidate()
    }

    override fun dispatchDraw(canvas: Canvas) {
        super.dispatchDraw(canvas)
        if (!isSelectedBackground) return

        val stroke = 2.dp.toFloat()
        val halfStroke = stroke / 2
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = stroke
            color = WColor.Tint.color
        }
        canvas.drawRoundRect(
            halfStroke,
            halfStroke,
            width - halfStroke,
            height - halfStroke,
            8f.dp,
            8f.dp,
            paint
        )
    }
}
