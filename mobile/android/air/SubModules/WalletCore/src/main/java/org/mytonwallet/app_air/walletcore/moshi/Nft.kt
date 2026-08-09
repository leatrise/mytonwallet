package org.mytonwallet.app_air.walletcore.moshi

import android.net.Uri
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import org.json.JSONObject
import org.mytonwallet.app_air.walletcontext.models.MBlockchainNetwork
import org.mytonwallet.app_air.walletcontext.utils.WEquatable
import org.mytonwallet.app_air.walletcore.TELEGRAM_USERNAMES_COLLECTION
import org.mytonwallet.app_air.walletcore.TON_DNS_COLLECTION
import org.mytonwallet.app_air.walletcore.WalletCore
import org.mytonwallet.app_air.walletcore.helpers.ExplorerHelpers
import org.mytonwallet.app_air.walletcore.models.MMarketplace
import org.mytonwallet.app_air.walletcore.models.blockchain.MBlockchain
import org.mytonwallet.app_air.walletcore.stores.NftStore

@JsonClass(generateAdapter = true)
data class MApiCheckNftDraftOptions(
    val accountId: String,
    val nfts: List<JSONObject>,
    val toAddress: String,
    val comment: String?,
    val isNftBurn: Boolean,
)

@JsonClass(generateAdapter = true)
data class ApiNftMetadata(
    @Json(name = "lottie") val lottie: String? = null,
    @Json(name = "imageUrl") val imageUrl: String? = null,
    @Json(name = "fragmentUrl") val fragmentUrl: String? = null,
    @Json(name = "attributes") val attributes: List<Attribute?>? = null,
) {
    data class Attribute(
        @Json(name = "trait_type") val traitType: String?,
        @Json(name = "value") val value: String?
    )

}

@JsonClass(generateAdapter = false)
enum class ApiNftInterface {
    @Json(name = "default")
    DEFAULT,

    @Json(name = "ERC721")
    ERC721,

    @Json(name = "ERC1155")
    ERC1155,

    @Json(name = "compressed")
    COMPRESSED,

    @Json(name = "mplCore")
    MPL_CORE,
}

@JsonClass(generateAdapter = true)
data class ApiNftCompression(
    val tree: String? = null,
    val dataHash: String? = null,
    val creatorHash: String? = null,
    val leafId: Int? = null
)

@JsonClass(generateAdapter = true)
data class ApiNft(
    // val index: Int?,
    val chain: MBlockchain? = null,
    val ownerAddress: String? = null,
    val name: String? = null,
    val address: String,
    val thumbnail: String?,
    val image: String?,
    val description: String? = null,
    val collectionName: String? = null,
    val collectionAddress: String? = null,
    val isOnSale: Boolean,
    val isHidden: Boolean? = null,
    val isOnFragment: Boolean? = null,
    val isTelegramGift: Boolean? = null,
    val isScam: Boolean? = null,
    val metadata: ApiNftMetadata? = null,
    val `interface`: ApiNftInterface? = null,
    val compression: ApiNftCompression? = null,
) : WEquatable<ApiNft> {

    companion object {
        fun fromJson(jsonObject: JSONObject): ApiNft? {
            val adapter = WalletCore.moshi.adapter(ApiNft::class.java)
            return adapter.fromJson(jsonObject.toString())
        }
    }

    fun toDictionary(): JSONObject {
        val adapter = WalletCore.moshi.adapter(ApiNft::class.java)
        return JSONObject(adapter.toJson(this))
    }

    fun isStandalone() = collectionName.isNullOrBlank()

    var fragmentUrl: String? = when {
        metadata?.fragmentUrl != null -> metadata.fragmentUrl
        collectionName?.lowercase()?.contains("numbers") ?: false ->
            MMarketplace.Fragment.numberUrl(name?.replace(Regex("[^0-9]"), "") ?: "")

        else ->
            MMarketplace.Fragment.usernameUrl(
                name?.takeIf { it.length > 1 }?.substring(1) ?: ""
            )
    }

    val isTonDns: Boolean
        get() {
            return collectionAddress == TON_DNS_COLLECTION
        }
    val tonDnsUrl: String
        get() {
            return "https://dns.ton.org/#${
                name?.replace(
                    Regex("\\.ton$", RegexOption.IGNORE_CASE),
                    ""
                )
            }"
        }

    val isTelegramUsername: Boolean
        get() {
            return collectionAddress == TELEGRAM_USERNAMES_COLLECTION
        }

    fun scanUrl(network: MBlockchainNetwork): String {
        val urlBuilder = Uri.Builder()
            .appendPath("nft")
            .appendPath(address)
        return ExplorerHelpers.mtwScanUrl(network, urlBuilder)
    }

    val collectionUrl: String?
        get() {
            return when (chain) {
                MBlockchain.ton -> {
                    collectionAddress?.let { MMarketplace.Getgems.collectionUrl(it) }
                }

                else -> {
                    null
                }
            }
        }

    fun shouldHide(): Boolean {
        if (NftStore.nftData?.whitelistedNftAddresses?.contains(address) == true)
            return false
        return isHidden == true || NftStore.nftData?.blacklistedNftAddresses?.contains(address) == true
    }

    fun canRenew(): Boolean {
        return NftStore.nftData?.expirationByAddress?.contains(address) == true
    }

    fun canLinkToAddress(): Boolean {
        return isTonDns || isTelegramUsername
    }

    override fun isSame(comparing: WEquatable<*>): Boolean {
        if (comparing is ApiNft)
            return address == comparing.address
        return false
    }

    override fun isChanged(comparing: WEquatable<*>): Boolean {
        if (comparing is ApiNft)
            return isHidden != comparing.isHidden || isOnSale != comparing.isOnSale
        return true
    }
}
