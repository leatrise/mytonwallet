import SwiftUI
import UIComponents
import WalletCore
import WalletContext

struct CardBackgroundSection: View {
    let selectedBackground: CardBackground
    let onSelect: (CardBackground) -> Void

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 8), count: 4)

    var body: some View {
        InsetSection {
            LazyVGrid(columns: columns, spacing: 8) {
                ForEach(CardBackground.allCases) { background in
                    CardBackgroundOption(
                        background: background,
                        isSelected: background == selectedBackground,
                        onTap: { onSelect(background) }
                    )
                }
            }
            .padding(12)
        } header: {
            Text(lang("Background"))
        }
    }
}

struct CardBackgroundOption: View {
    let background: CardBackground
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Image.airBundle(background.imageName)
            .resizable()
            .aspectRatio(1.55, contentMode: .fill)
            .overlay(alignment: .topLeading) {
                Text(background.label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.35), radius: 2, y: 1)
                    .padding(8)
            }
            .clipShape(.rect(cornerRadius: 8))
            .overlay {
                if isSelected {
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(Color.accentColor, lineWidth: 2)
                }
            }
            .contentShape(.rect)
            .onTapGesture(perform: onTap)
    }
}
