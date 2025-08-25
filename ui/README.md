# HyperValentPulse Dashboard

A sophisticated DeFi analytics dashboard that provides real-time insights into blockchain transactions with AI-powered market sentiment analysis.

## Features

### 📊 Market Analytics
- **Live Market Verdict**: Real-time bullish/bearish market sentiment with percentage breakdown
- **Classification Distribution**: Visual pie chart showing transaction sentiment distribution
- **Volume Analysis**: Bar chart displaying trading volume by sentiment in millions
- **Token Statistics**: Comprehensive metrics for 65+ different tokens

### 🔍 Transaction Analysis
- **Transaction Feed**: Paginated view of 1,291+ analyzed transactions (10 per page)
- **AI-Powered Insights**: Each transaction includes LLM-generated reasoning and market impact analysis
- **Advanced Filtering**: Filter transactions by token type and classification
- **Detailed Transaction Data**: Complete transaction hashes, timestamps, amounts, and addresses

### 🎨 User Experience
- **Dual Theme Support**: Toggle between light and dark modes
- **Responsive Design**: Optimized for all device sizes
- **Interactive Charts**: Custom CSS-based charts with hover effects and legends
- **Real-time Updates**: Live analytics with timestamp tracking

## Technology Stack

- **Frontend**: Next.js 14 with App Router
- **Styling**: Tailwind CSS v4 with custom design tokens
- **UI Components**: shadcn/ui component library
- **Theme Management**: next-themes for dark/light mode switching
- **Typography**: Geist font family
- **Data Visualization**: Custom CSS-based charts
- **Language**: TypeScript for type safety

## Project Structure

## 📂 Project Structure

```bash
├── app/
│   ├── layout.tsx          # Root layout with theme provider
│   ├── page.tsx            # Main dashboard component
│   └── globals.css         # Global styles and theme variables
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── theme-provider.tsx  # Theme context provider
├── data/
│   ├── statistics.json     # Aggregated market statistics
│   └── llm_answers.json    # Individual transaction records with AI analysis
└── README.md
```


## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Installation

1. Clone the repository
\`\`\`bash
git clone <repository-url>
cd blockchain-dashboard
\`\`\`

2. Install dependencies
\`\`\`bash
npm install
# or
yarn install
\`\`\`

3. Run the development server
\`\`\`bash
npm run dev
# or
yarn dev
\`\`\`

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Data Sources

The dashboard analyzes real blockchain transaction data:

- **1,291 Transaction Records**: Complete transaction history with AI analysis
- **65+ Token Types**: Including UBTC, ETH, USDC, and other major cryptocurrencies
- **Market Sentiment**: 97.25% bullish vs 2.75% bearish classification
- **Volume Analysis**: Multi-million dollar transaction volumes tracked

## Features in Detail

### Market Verdict Banner
Displays the overall market sentiment with:
- Percentage breakdown of bullish vs bearish sentiment
- Total sample size and confidence metrics
- Color-coded indicators (green for bullish, red for bearish)

### Interactive Charts
- **Classification Distribution**: Pie chart showing sentiment breakdown
- **Volume by Sentiment**: Bar chart displaying trading volumes
- **Responsive Design**: Charts adapt to theme changes and screen sizes

### Transaction Feed
- **Pagination**: 10 transactions per page with navigation controls
- **Expandable Details**: Click to view AI reasoning for each transaction
- **Token Filtering**: Filter by specific cryptocurrencies
- **Classification Filtering**: Filter by bullish, bearish, or neutral sentiment

### Theme System
- **Light Mode**: Clean white background with dark text
- **Dark Mode**: DeFi-inspired dark theme with neon accents
- **Persistent Settings**: Theme preference saved across sessions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with Next.js and Tailwind CSS
- UI components from shadcn/ui
- AI-powered transaction analysis
- Real blockchain data integration
