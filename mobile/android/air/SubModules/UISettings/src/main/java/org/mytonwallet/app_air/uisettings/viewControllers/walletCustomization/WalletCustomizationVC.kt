package org.mytonwallet.app_air.uisettings.viewControllers.walletCustomization

import android.content.Context
import android.view.MotionEvent
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.widget.LinearLayout
import androidx.core.graphics.toColorInt
import org.mytonwallet.app_air.uicomponents.base.WNavigationBar
import org.mytonwallet.app_air.uicomponents.base.WViewController
import org.mytonwallet.app_air.uicomponents.commonViews.CardBackground
import org.mytonwallet.app_air.uicomponents.extensions.dp
import org.mytonwallet.app_air.uicomponents.extensions.setPaddingLocalized
import org.mytonwallet.app_air.uicomponents.helpers.DirectionalTouchHandler
import org.mytonwallet.app_air.uicomponents.widgets.WScrollView
import org.mytonwallet.app_air.uicomponents.widgets.setBackgroundColor
import org.mytonwallet.app_air.uicomponents.widgets.updateThemeForChildren
import org.mytonwallet.app_air.uisettings.viewControllers.appearance.views.palette.AppearancePaletteItemView
import org.mytonwallet.app_air.uisettings.viewControllers.appearance.views.palette.AppearancePaletteView
import org.mytonwallet.app_air.uisettings.viewControllers.walletCustomization.views.WalletCustomizationBackgroundsView
import org.mytonwallet.app_air.uisettings.viewControllers.walletCustomization.views.cards.WalletCustomizationCardsView
import org.mytonwallet.app_air.walletbasecontext.localization.LocaleController
import org.mytonwallet.app_air.walletbasecontext.theme.DEFAULT_TINT_DARK
import org.mytonwallet.app_air.walletbasecontext.theme.DEFAULT_TINT_LIGHT
import org.mytonwallet.app_air.walletbasecontext.theme.NftAccentColors
import org.mytonwallet.app_air.walletbasecontext.theme.ThemeManager.isDark
import org.mytonwallet.app_air.walletbasecontext.theme.ViewConstants
import org.mytonwallet.app_air.walletbasecontext.theme.WColor
import org.mytonwallet.app_air.walletbasecontext.theme.color
import org.mytonwallet.app_air.walletcontext.WalletContextManager
import org.mytonwallet.app_air.walletcontext.globalStorage.WGlobalStorage
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.WalletEvent
import org.mytonwallet.app_air.walletcore.models.MAccount
import org.mytonwallet.app_air.walletcore.stores.AccountStore
import java.lang.ref.WeakReference

class WalletCustomizationVC(context: Context, defaultSelectedAccountId: String) :
    WViewController(context) {

    override val TAG = "WalletCustomization"
    override val shouldDisplayBottomBar = true
    override var title: String? = LocaleController.getString("Customize Wallet")
    override val isSwipeBackAllowed = false
    override val isEdgeSwipeBackAllowed = true

    private val accounts = WalletCore.getAllAccounts()
    private var tintColor = 0
    private var tintId: Int? = null
        set(value) {
            field = value
            updateTintColor()
            updateTheme()
            updateThemeForChildren(view, true)
        }

    private var selectedAccount =
        accounts.firstOrNull { it.accountId == defaultSelectedAccountId } ?: accounts.first()
        set(value) {
            field = value
            tintId = WGlobalStorage.getNftAccentColorIndex(value.accountId)
        }

    private val isPresentedOverWalletTabs: Boolean
        get() = navigationController?.viewControllers?.size == 1

    private val cardsView: WalletCustomizationCardsView by lazy {
        object : WalletCustomizationCardsView(context, accounts, selectedAccount.accountId) {
            override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
                return touchHandler.dispatchTouch(cardsView, ev) ?: super.dispatchTouchEvent(ev)
            }
        }.apply {
            onItemChangeListener = object : WalletCustomizationCardsView.OnItemChangeListener {
                override fun onItemOffsetChanged(
                    fromIndex: Int,
                    toIndex: Int,
                    offsetPercent: Float,
                ) {
                    val selectedIndex = if (offsetPercent > 0.5f) toIndex else fromIndex
                    accounts.getOrNull(selectedIndex)?.let(::selectAccount)
                }
            }
        }
    }

    private val backgroundsView = WalletCustomizationBackgroundsView(context).apply {
        onBackgroundSelected = { background ->
            val accountId = selectedAccount.accountId
            WGlobalStorage.setCardBackground(accountId, background.id)
            configure(background)
            cardsView.reload(accountId)
            if (AccountStore.activeAccountId == accountId || isPresentedOverWalletTabs) {
                WalletCore.notifyEvent(WalletEvent.NftCardUpdated)
            }
        }
    }

    private val appPaletteView = AppearancePaletteView(context, showUnlockButton = false).apply {
        onPaletteSelected = { accountId, nftAccentId, state, _ ->
            if (state == AppearancePaletteItemView.State.AVAILABLE) {
                WGlobalStorage.setNftAccentColor(accountId, nftAccentId, null)
                tintId = nftAccentId
                WalletContextManager.delegate?.get()?.themeChanged()
                reloadViews()
            }
        }
    }

    private val contentView by lazy {
        LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            addView(
                cardsView,
                LinearLayout.LayoutParams(
                    MATCH_PARENT,
                    WalletCustomizationCardsView.heightForWidth(window!!.windowView.width),
                ).apply {
                    topMargin = 17.dp
                },
            )
            addView(
                backgroundsView,
                LinearLayout.LayoutParams(MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = ViewConstants.GAP.dp
                    leftMargin = ViewConstants.HORIZONTAL_PADDINGS.dp
                    rightMargin = ViewConstants.HORIZONTAL_PADDINGS.dp
                },
            )
            addView(
                appPaletteView,
                LinearLayout.LayoutParams(MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    topMargin = ViewConstants.GAP.dp
                    leftMargin = ViewConstants.HORIZONTAL_PADDINGS.dp
                    rightMargin = ViewConstants.HORIZONTAL_PADDINGS.dp
                },
            )
        }
    }

    private val scrollView: WScrollView by lazy {
        object : WScrollView(WeakReference(this@WalletCustomizationVC)) {
            override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
                return touchHandler.dispatchTouch(scrollView, ev) ?: super.dispatchTouchEvent(ev)
            }
        }.apply {
            addView(contentView, ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            clipToPadding = false
            onScrollStateChange = {
                updateBlurViews(scrollView)
            }
            setOnScrollChangeListener { _, _, scrollY, _, _ ->
                if (scrollY > 0) {
                    topReversedCornerView?.resumeBlurring()
                } else {
                    topReversedCornerView?.pauseBlurring(false)
                }
                if (scrollY > ViewConstants.BLOCK_RADIUS.dp) {
                    setTopBlur(true, animated = true)
                    topReversedCornerView?.setHorizontalPadding(0f)
                } else {
                    setTopBlur(false, animated = true)
                }
            }
        }
    }

    private val touchHandler by lazy {
        DirectionalTouchHandler(
            verticalView = scrollView,
            horizontalView = cardsView,
            interceptedViews = listOf(),
            interceptedByVerticalScrollViews = listOf(cardsView),
            isDirectionalScrollAllowed = { _, _ -> true },
        )
    }

    override fun setupViews() {
        super.setupViews()

        setupNavBar(true)
        setTopBlur(false, animated = false)
        view.addView(scrollView, ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        configureSelection()

        if ((navigationController?.viewControllers?.size ?: 0) < 2) {
            navigationBar?.addCloseButton()
        }

        updateTheme()
    }

    private fun selectAccount(account: MAccount) {
        if (selectedAccount.accountId == account.accountId) return
        selectedAccount = account
        configureSelection()
    }

    private fun configureSelection() {
        val accountId = selectedAccount.accountId
        val savedTintId = WGlobalStorage.getNftAccentColorIndex(accountId)
        if (tintId != savedTintId) {
            tintId = savedTintId
        }
        backgroundsView.configure(
            CardBackground.fromId(WGlobalStorage.getCardBackground(accountId)),
        )
        appPaletteView.updatePaletteView(accountId, emptyList())
    }

    private fun updateTintColor() {
        tintColor = tintId?.let {
            (if (isDark) NftAccentColors.dark else NftAccentColors.light)[it].toColorInt()
        } ?: if (isDark) DEFAULT_TINT_DARK else DEFAULT_TINT_LIGHT
        appPaletteView.overrideTintColor = tintColor
    }

    override fun updateTheme() {
        updateTintColor()
        super.updateTheme()
        view.setBackgroundColor(WColor.SecondaryBackground.color)
    }

    override fun insetsUpdated() {
        super.insetsUpdated()
        scrollView.setPaddingLocalized(
            additionalTabletPadding + systemBarStartInset,
            (navigationController?.getSystemBars()?.top ?: 0) + WNavigationBar.DEFAULT_HEIGHT.dp,
            systemBarEndInset,
            20.dp + (navigationController?.getSystemBars()?.bottom ?: 0),
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        cardsView.onItemChangeListener = null
        cardsView.onDestroy()
        backgroundsView.onBackgroundSelected = null
        appPaletteView.onPaletteSelected = null
        scrollView.setOnScrollChangeListener(null)
    }
}
