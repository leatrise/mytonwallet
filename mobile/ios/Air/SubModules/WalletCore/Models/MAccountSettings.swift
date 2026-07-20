import Foundation
import GRDB
import WalletContext

public struct MAccountSettings: Equatable, Hashable, Codable, Sendable, FetchableRecord, PersistableRecord {
    public let accountId: String
    public var cardBackgroundNft: ApiNft?
    public var cardBackground: CardBackground?
    public var accentColorNft: ApiNft?
    public var accentColorIndex: Int?
    public var isAllowSuspiciousActions: Bool?
    public var portfolioTimeRange: String?

    public init(
        accountId: String,
        cardBackgroundNft: ApiNft?,
        cardBackground: CardBackground?,
        accentColorNft: ApiNft?,
        accentColorIndex: Int?,
        isAllowSuspiciousActions: Bool?,
        portfolioTimeRange: String?
    ) {
        self.accountId = accountId
        self.cardBackgroundNft = cardBackgroundNft
        self.cardBackground = cardBackground
        self.accentColorNft = accentColorNft
        self.accentColorIndex = accentColorIndex
        self.isAllowSuspiciousActions = isAllowSuspiciousActions
        self.portfolioTimeRange = portfolioTimeRange
    }

    public init(accountId: String, settingsDict: [String: Any]) {
        self.init(
            accountId: accountId,
            cardBackgroundNft: settingsDict["cardBackgroundNft"].flatMap { try? JSONSerialization.decode(ApiNft.self, from: $0) },
            cardBackground: (settingsDict["cardBackground"] as? String).flatMap(CardBackground.init(rawValue:)),
            accentColorNft: settingsDict["accentColorNft"].flatMap { try? JSONSerialization.decode(ApiNft.self, from: $0) },
            accentColorIndex: settingsDict["accentColorIndex"] as? Int,
            isAllowSuspiciousActions: settingsDict["isAllowSuspiciousActions"] as? Bool,
            portfolioTimeRange: nil
        )
    }

    public static let databaseTableName: String = "account_settings"
}

extension MAccountSettings {
    public var hasData: Bool {
        cardBackgroundNft != nil
            || cardBackground != nil
            || accentColorNft != nil
            || accentColorIndex != nil
            || isAllowSuspiciousActions != nil
            || portfolioTimeRange != nil
    }
}
