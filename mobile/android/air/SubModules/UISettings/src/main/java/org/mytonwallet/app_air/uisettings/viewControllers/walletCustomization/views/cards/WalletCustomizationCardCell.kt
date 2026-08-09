package org.mytonwallet.app_air.uisettings.viewControllers.walletCustomization.views.cards

import android.annotation.SuppressLint
import org.mytonwallet.app_air.uicomponents.helpers.adaptiveFontSize
import android.content.Context
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Shader
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.ImageView
import androidx.constraintlayout.widget.ConstraintLayout.LayoutParams.MATCH_CONSTRAINT
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.extensions.setPaddingDpLocalized
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.helpers.typeface
import org.mytonwallet.app_air.uicomponents.widgets.AutoScaleContainerView
import org.mytonwallet.app_air.uicomponents.commonViews.CardBackground
import org.mytonwallet.app_air.uicomponents.widgets.WCell
import org.mytonwallet.app_air.uicomponents.widgets.WImageView
import org.mytonwallet.app_air.uicomponents.widgets.WLabel
import org.mytonwallet.app_air.uicomponents.widgets.WMultichainAddressLabel
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uicomponents.widgets.balance.WBalanceView
import org.mytonwallet.app_air.uicomponents.widgets.sensitiveDataContainer.SensitiveDataMaskView
import org.mytonwallet.app_air.uicomponents.widgets.sensitiveDataContainer.WSensitiveDataContainer
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.walletbasecontext.localization.LocaleController
import org.mytonwallet.app_air.walletbasecontext.utils.toBigInteger
import org.mytonwallet.app_air.walletcontext.globalStorage.WGlobalStorage
import org.mytonwallet.app_air.walletcontext.utils.colorWithAlpha
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.models.MAccount
import org.mytonwallet.app_air.walletcore.stores.BalanceStore
import kotlin.math.roundToInt

@SuppressLint("ViewConstructor")
class WalletCustomizationCardCell(context: Context, cellWidth: Int) :
    WCell(context, LayoutParams(cellWidth, (cellWidth / RATIO).roundToInt())), WThemedView {

    companion object {
        const val RATIO = 274 / 176f
    }

    var cellWidth: Int = cellWidth
        private set

    private val cellHeight: Float
        get() = cellWidth / RATIO

    init {
        pivotY = cellHeight / 2
    }

    fun updateCellWidth(newWidth: Int) {
        if (newWidth == cellWidth || newWidth <= 0) return
        cellWidth = newWidth
        layoutParams = layoutParams.apply {
            width = newWidth
            height = (newWidth / RATIO).roundToInt()
        }
        pivotY = cellHeight / 2
        balanceView.containerWidth = newWidth
        balanceContainerView.contentView.maxAllowedWidth = newWidth
        addressLabel.containerWidth = newWidth
    }

    private val imageView = WImageView(context, 20.dp).apply {
        scaleType = ImageView.ScaleType.CENTER_CROP
    }

    private val titleLabel = WLabel(context).apply {
        setStyle(17f, WFont.Medium)
        setLineHeight(TypedValue.COMPLEX_UNIT_DIP, 22f)
        gravity = Gravity.CENTER
        setSingleLine()
        ellipsize = TextUtils.TruncateAt.END
        useCustomEmoji = true
    }

    private val balanceView = WBalanceView(context).apply {
        currencySize = 38f
        primarySize = 42f
        decimalsSize = 32f
        typeface = WFont.Balance.typeface
        containerWidth = cellWidth
    }

    private val balanceContainerView = WSensitiveDataContainer(
        AutoScaleContainerView(balanceView).apply {
            clipChildren = false
            clipToPadding = false
            minPadding = 16.dp
            maxAllowedWidth = cellWidth
        },
        WSensitiveDataContainer.MaskConfig(
            6,
            2,
            Gravity.CENTER,
            skin = SensitiveDataMaskView.Skin.DARK_THEME,
            protectContentLayoutSize = false
        )
    ).apply {
        clipChildren = false
        clipToPadding = false
    }

    private val addressLabel: WMultichainAddressLabel by lazy {
        WMultichainAddressLabel(context).apply {
            setStyle(adaptiveFontSize(), WFont.Medium)
            setPaddingDpLocalized(3, 0, 1, 1)
            gravity = Gravity.CENTER
            containerWidth = cellWidth
        }
    }

    override fun setupViews() {
        super.setupViews()

        addView(imageView, LayoutParams(0, 0))
        addView(titleLabel, LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        addView(balanceContainerView, LayoutParams(0, MATCH_PARENT))
        addView(addressLabel, LayoutParams(MATCH_CONSTRAINT, WRAP_CONTENT))

        setConstraints {
            allEdges(imageView)
            toTop(titleLabel, 16f)
            toCenterX(balanceContainerView)
            toTop(balanceContainerView, -4f)
            toBottom(balanceContainerView, 4f)
            toCenterX(addressLabel, 16f)
            toBottom(addressLabel, 16f)
        }
    }

    override fun updateTheme() {
        setBackgroundColor(Color.TRANSPARENT, 20f.dp, true)
        setLabelColors(Color.WHITE, Color.WHITE.colorWithAlpha(191), drawGradient = false)
    }

    private var account: MAccount? = null
    private var cardBackground: CardBackground = CardBackground.DEFAULT

    fun configure(account: MAccount) {
        this.account = account
        titleLabel.text = account.name

        updateCardImage()
        updateBalance()
    }

    fun updateCardImage() {
        val accountId = account?.accountId
        cardBackground = CardBackground.fromId(accountId?.let { WGlobalStorage.getCardBackground(it) })
        updateTheme()
        imageView.loadRes(cardBackground.imageRes)
        setConstraints {
            allEdges(imageView)
        }
    }

    private fun setLabelColors(primaryColor: Int, secondaryColor: Int, drawGradient: Boolean) {
        var textShader: LinearGradient?
        balanceView.alpha = 1f
        textShader = null
        titleLabel.setTextColor(primaryColor)
        balanceView.updateColors(primaryColor, secondaryColor, drawGradient)
        addressLabel.setTextColor(primaryColor, secondaryColor, drawGradient)
        if (textShader == null) {
            addressLabel.paint.shader = null
        } else {
            addressLabel.paint.shader = textShader
            addressLabel.invalidate()
        }
        val style = when (account?.accountType) {
            MAccount.AccountType.VIEW -> WMultichainAddressLabel.walletCustomizationViewStyle
            MAccount.AccountType.HARDWARE -> WMultichainAddressLabel.walletCustomizationHardwareStyle
            else -> WMultichainAddressLabel.walletCustomizationStyle
        }
        addressLabel.displayAddresses(account, style)
    }

    private fun updateBalance() {
        val accountId = account?.accountId ?: return
        val balance = BalanceStore.totalBalanceInBaseCurrency(accountId)
        balanceView.animateText(
            WBalanceView.AnimateConfig(
                amount = balance?.toBigInteger(WalletCore.baseCurrency.decimalsCount),
                decimals = WalletCore.baseCurrency.decimalsCount,
                currency = WalletCore.baseCurrency.sign,
                animated = false,
                setInstantly = true,
                forceCurrencyToRight = LocaleController.isRTL
            )
        )
    }
}
