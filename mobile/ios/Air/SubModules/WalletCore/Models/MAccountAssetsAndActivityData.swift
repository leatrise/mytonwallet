import Foundation
import GRDB
import WalletContext

public struct MAccountAssetsAndActivityData: Equatable, Hashable, Codable, Sendable, FetchableRecord, PersistableRecord {
    public let accountId: String
    public var alwaysHiddenSlugs: [String]
    public var importedSlugs: [String]
    public var pinnedSlugs: [String]?
    public var wasYohiAutoPinned: Bool
    public var didAutoPinStaking: Bool
    public var ownedMtwCardAddresses: [String]

    public init(
        accountId: String,
        alwaysHiddenSlugs: [String],
        importedSlugs: [String],
        pinnedSlugs: [String]?,
        wasYohiAutoPinned: Bool = false,
        didAutoPinStaking: Bool,
        ownedMtwCardAddresses: [String] = []
    ) {
        self.accountId = accountId
        self.alwaysHiddenSlugs = alwaysHiddenSlugs
        self.importedSlugs = importedSlugs
        self.pinnedSlugs = pinnedSlugs
        self.wasYohiAutoPinned = wasYohiAutoPinned
        self.didAutoPinStaking = didAutoPinStaking
        self.ownedMtwCardAddresses = ownedMtwCardAddresses
    }

    public init(
        accountId: String,
        data: MAssetsAndActivityData,
        didAutoPinStaking: Bool = false,
        ownedMtwCardAddresses: [String] = []
    ) {
        let dict = data.toDictionary
        self.init(
            accountId: accountId,
            alwaysHiddenSlugs: dict["alwaysHiddenSlugs"] as? [String] ?? [],
            importedSlugs: dict["importedSlugs"] as? [String] ?? [],
            pinnedSlugs: dict["pinnedSlugs"] as? [String],
            wasYohiAutoPinned: dict["wasYohiAutoPinned"] as? Bool ?? false,
            didAutoPinStaking: didAutoPinStaking,
            ownedMtwCardAddresses: ownedMtwCardAddresses
        )
    }

    public static let databaseTableName: String = "account_assets_and_activity_data"
}

extension MAccountAssetsAndActivityData {
    public var data: MAssetsAndActivityData {
        var dict: [String: Any] = [
            "alwaysHiddenSlugs": alwaysHiddenSlugs,
            "importedSlugs": importedSlugs,
            "wasYohiAutoPinned": wasYohiAutoPinned,
        ]
        if let pinnedSlugs {
            dict["pinnedSlugs"] = pinnedSlugs
        }
        return MAssetsAndActivityData(dictionary: dict)
    }

    public var hasData: Bool {
        !alwaysHiddenSlugs.isEmpty
            || !importedSlugs.isEmpty
            || (pinnedSlugs?.isEmpty == false)
            || wasYohiAutoPinned
            || !ownedMtwCardAddresses.isEmpty
    }
}
