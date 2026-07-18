package org.mytonwallet.app_air.uisettings.viewControllers.assetsAndActivities.cells

import android.annotation.SuppressLint
import org.mytonwallet.app_air.uicomponents.helpers.adaptiveFontSize
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import androidx.recyclerview.widget.RecyclerView
import org.mytonwallet.app_air.uicomponents.base.WNavigationController
import org.mytonwallet.app_air.uicomponents.commonViews.cells.HeaderCell
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.helpers.WFont
import org.mytonwallet.app_air.uicomponents.viewControllers.selector.TokenSelectorHelper
import org.mytonwallet.app_air.uicomponents.widgets.WCell
import org.mytonwallet.app_air.uicomponents.widgets.WImageView
import org.mytonwallet.app_air.uicomponents.widgets.WLabel
import org.mytonwallet.app_air.uicomponents.widgets.WSwitch
import org.mytonwallet.app_air.uicomponents.widgets.WThemedView
import org.mytonwallet.app_air.uicomponents.widgets.WView
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.uisettings.R
import org.mytonwallet.app_air.uisettings.viewControllers.baseCurrency.BaseCurrencyVC
import org.mytonwallet.app_air.walletbasecontext.localization.LocaleController
import org.mytonwallet.app_air.walletbasecontext.theme.ViewConstants
import org.mytonwallet.app_air.walletbasecontext.theme.WColor
import org.mytonwallet.app_air.walletbasecontext.theme.color
import org.mytonwallet.app_air.walletbasecontext.utils.getDrawableCompat
import org.mytonwallet.app_air.walletcontext.globalStorage.WGlobalStorage
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.WalletEvent
import org.mytonwallet.app_air.walletcore.stores.AccountStore

@SuppressLint("ViewConstructor")
class AssetsAndActivitiesHeaderCell(
    navigationController: WNavigationController,
    recyclerView: RecyclerView
) :
    WCell(recyclerView.context, LayoutParams(MATCH_PARENT, WRAP_CONTENT)),
    WThemedView {

    private val baseCurrencyLabel: WLabel by lazy {
        val lbl = WLabel(context)
        lbl.setStyle(adaptiveFontSize())
        lbl.text =
            LocaleController.getString("Base Currency")
        lbl
    }

    private val currentBaseCurrencyLabel: WLabel by lazy {
        val lbl = WLabel(context)
        lbl.setStyle(adaptiveFontSize())
        lbl
    }

    private val baseCurrencyView: WView by lazy {
        val v = WView(context)
        v.addView(baseCurrencyLabel)
        v.addView(currentBaseCurrencyLabel)
        v.setConstraints {
            toStart(baseCurrencyLabel, 20f)
            toCenterY(baseCurrencyLabel)
            toEnd(currentBaseCurrencyLabel, 20f)
            toCenterY(currentBaseCurrencyLabel)
        }
        v.setOnClickListener {
            navigationController.push(BaseCurrencyVC(context))
        }
        v
    }

    private val showTinyTransfersLabel: WLabel by lazy {
        val lbl = WLabel(context)
        lbl.setStyle(adaptiveFontSize())
        lbl.text =
            LocaleController.getString("Show Tiny Transfers")
        lbl
    }

    private val showTinyTransfersSwitch: WSwitch by lazy {
        val switchView = WSwitch(context)
        switchView.isChecked = !WGlobalStorage.getAreTinyTransfersHidden()
        switchView.setOnCheckedChangeListener { _, isChecked ->
            WGlobalStorage.setAreTinyTransfersHidden(!isChecked)
            WalletCore.notifyEvent(WalletEvent.HideTinyTransfersChanged)
        }
        switchView
    }

    private val showTinyTransfersRow: WView by lazy {
        val v = WView(context)
        v.addView(showTinyTransfersLabel)
        v.addView(showTinyTransfersSwitch)
        v.setConstraints {
            toStart(showTinyTransfersLabel, 20f)
            toCenterY(showTinyTransfersLabel)
            toEnd(showTinyTransfersSwitch, 20f)
            toCenterY(showTinyTransfersSwitch)
        }
        v.setOnClickListener {
            showTinyTransfersSwitch.isChecked = !showTinyTransfersSwitch.isChecked
        }
        v
    }

    private val showLowValueTokensLabel: WLabel by lazy {
        val lbl = WLabel(context)
        lbl.setStyle(adaptiveFontSize())
        lbl.text =
            LocaleController.getString("Show Low-Value Tokens")
        lbl
    }

    private val showLowValueTokensSwitch: WSwitch by lazy {
        val switchView = WSwitch(context)
        switchView.isChecked = !WGlobalStorage.getAreNoCostTokensHidden()
        switchView.setOnCheckedChangeListener { _, isChecked ->
            onHideNoCostTokensChanged(!isChecked)
        }
        switchView
    }

    private val showLowValueTokensRow: WView by lazy {
        val v = WView(context)
        v.addView(showLowValueTokensLabel)
        v.addView(showLowValueTokensSwitch)
        v.setConstraints {
            toStart(showLowValueTokensLabel, 20f)
            toCenterY(showLowValueTokensLabel)
            toEnd(showLowValueTokensSwitch, 20f)
            toCenterY(showLowValueTokensSwitch)
        }
        v.setOnClickListener {
            showLowValueTokensSwitch.isChecked = !showLowValueTokensSwitch.isChecked
        }
        v
    }

    private val tokensOnHomeScreenLabel = HeaderCell(context).apply {
        configure(
            LocaleController.getString("Tokens on Home Screen"),
            titleColor = WColor.Tint,
            topRounding = HeaderCell.TopRounding.NORMAL
        )
    }

    private val addIcon: WImageView by lazy {
        val iv = WImageView(context)
        iv.setImageDrawable(context.getDrawableCompat(R.drawable.ic_plus)?.apply {
            setTint(WColor.Tint.color)
        })
        iv
    }

    private val addTokenLabel: WLabel by lazy {
        val lbl = WLabel(context)
        lbl.setStyle(14f, WFont.Medium)
        lbl.text =
            LocaleController.getString("Add Token")
        lbl
    }

    private val addTokenView: WView by lazy {
        val v = WView(context)
        v.addView(addIcon, LayoutParams(24.dp, 24.dp))
        v.addView(addTokenLabel)
        v.setConstraints {
            toCenterY(addTokenLabel)
            toStart(addTokenLabel, 68f)
            toCenterY(addIcon)
            toStart(addIcon, 20f)
        }
        v.setOnClickListener {
            val activeAccount = AccountStore.activeAccount ?: return@setOnClickListener
            navigationController.push(
                TokenSelectorHelper.buildAddTokenSelector(
                    context = context,
                    account = activeAccount
                )
            )
        }
        v
    }

    override fun setupViews() {
        super.setupViews()

        addView(baseCurrencyView, LayoutParams(MATCH_PARENT, 50.dp))
        addView(showTinyTransfersRow, LayoutParams(MATCH_PARENT, 50.dp))
        addView(showLowValueTokensRow, LayoutParams(MATCH_PARENT, 50.dp))
        addView(tokensOnHomeScreenLabel, LayoutParams(MATCH_PARENT, 48.dp))
        addView(addTokenView, LayoutParams(MATCH_PARENT, 50.dp))

        setConstraints {
            toTop(baseCurrencyView)
            toCenterX(baseCurrencyView)
            topToBottom(showTinyTransfersRow, baseCurrencyView)
            toCenterX(showTinyTransfersRow)
            topToBottom(showLowValueTokensRow, showTinyTransfersRow, ViewConstants.GAP.toFloat())
            toCenterX(showLowValueTokensRow)
            topToBottom(
                tokensOnHomeScreenLabel,
                showLowValueTokensRow,
                ViewConstants.GAP.toFloat()
            )
            toCenterX(tokensOnHomeScreenLabel)
            topToBottom(addTokenView, tokensOnHomeScreenLabel)
            toCenterX(addTokenView)
            toBottom(addTokenView)
        }

        updateTheme()
    }

    override fun updateTheme() {
        baseCurrencyView.setBackgroundColor(
            WColor.Background.color,
            ViewConstants.TOOLBAR_RADIUS.dp,
            0f,
        )
        baseCurrencyView.addRippleEffect(WColor.SecondaryBackground.color)
        baseCurrencyLabel.setTextColor(WColor.PrimaryText.color)
        currentBaseCurrencyLabel.setTextColor(WColor.SecondaryText.color)

        showTinyTransfersRow.addRippleEffect(WColor.SecondaryBackground.color)
        showTinyTransfersLabel.setTextColor(WColor.PrimaryText.color)

        showLowValueTokensRow.addRippleEffect(WColor.SecondaryBackground.color)
        showLowValueTokensLabel.setTextColor(WColor.PrimaryText.color)

        showTinyTransfersRow.setBackgroundColor(
            WColor.Background.color,
            0f,
            ViewConstants.BLOCK_RADIUS.dp
        )
        showLowValueTokensRow.setBackgroundColor(
            WColor.Background.color,
            25f.dp
        )

        updateAddTokenViewRadius()
        addTokenView.addRippleEffect(WColor.SecondaryBackground.color)
        addTokenLabel.setTextColor(WColor.Tint.color)
    }

    private fun updateAddTokenViewRadius() {
        val bottomRadius = if (hasTokens) 0f else ViewConstants.BLOCK_RADIUS.dp
        addTokenView.setBackgroundColor(WColor.Background.color, 0f, bottomRadius)
    }

    private var hasTokens: Boolean = true
    private lateinit var onHideNoCostTokensChanged: (hidden: Boolean) -> Unit
    fun configure(
        hasTokens: Boolean,
        onHideNoCostTokensChanged: (hidden: Boolean) -> Unit
    ) {
        this.hasTokens = hasTokens
        this.onHideNoCostTokensChanged = onHideNoCostTokensChanged
        currentBaseCurrencyLabel.text = WalletCore.baseCurrency.currencySymbol
        updateAddTokenViewRadius()
    }

}
