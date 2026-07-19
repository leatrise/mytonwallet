//
//  CustomizeWalletView.swift
//  UISettings
//
//  Created by nikstar on 02.11.2025.
//

import UIKit
import WalletCore
import WalletContext
import UIComponents
import SwiftUI
import Dependencies
import Perception
import OrderedCollections
import UIKitNavigation

struct CustomizeWalletView: View {
    
    let viewModel: CustomizeWalletViewModel
    
    var body: some View {
        InsetList(topPadding: 24, spacing: 16) {
            AccountSelectorView(viewModel: viewModel, onSelect: { accountId in
                withAnimation {
                    viewModel.selectedAccountId = accountId
                }
            })
            PaletteSection(viewModel: viewModel.palletteSettingsViewModel)
        }
        .backportSafeAreaPadding(.bottom, 32)
        .scrollIndicators(.hidden)
    }
}

