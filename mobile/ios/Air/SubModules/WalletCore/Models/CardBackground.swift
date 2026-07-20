import Foundation

public enum CardBackground: String, CaseIterable, Codable, Identifiable, Sendable {
    case `default`
    case orange
    case green
    case sea
    case purple
    case pink
    case red

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .default:
            "Yohi"
        case .orange:
            "Blue"
        case .green:
            "Green"
        case .sea:
            "Ocean"
        case .purple:
            "Purple"
        case .pink:
            "Pink"
        case .red:
            "Red"
        }
    }

    public var imageName: String {
        switch self {
        case .default:
            "CardBackgroundDefault"
        case .orange:
            "CardBackgroundBlue"
        case .green:
            "CardBackgroundGreen"
        case .sea:
            "CardBackgroundOcean"
        case .purple:
            "CardBackgroundPurple"
        case .pink:
            "CardBackgroundPink"
        case .red:
            "CardBackgroundRed"
        }
    }
}
