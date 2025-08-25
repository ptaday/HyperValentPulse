"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Zap,
  Shield,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useTheme } from "next-themes"

import statisticsData from "../data/statistics.json"
import transactionsData from "../data/llm_answers.json"

const SENTIMENT_COLORS = {
  Bullish: "#10b981", // Green for bullish
  Bearish: "#ef4444", // Red for bearish
  Neutral: "#6b7280", // Gray for neutral
}

const TRANSACTIONS_PER_PAGE = 10

const PieChart = ({ data }: { data: any[] }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let cumulativePercentage = 0

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-48 h-48">
        <svg width="192" height="192" className="transform -rotate-90">
          <circle cx="96" cy="96" r="80" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100
            const strokeDasharray = `${(percentage / 100) * 502.65} 502.65`
            const strokeDashoffset = -((cumulativePercentage / 100) * 502.65)
            cumulativePercentage += percentage

            return (
              <circle
                key={index}
                cx="96"
                cy="96"
                r="80"
                fill="none"
                stroke={item.color}
                strokeWidth="16"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-300"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-sm text-foreground">
              {item.name}: {item.percentage}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const BarChart = ({ data }: { data: any[] }) => {
  const maxValue = Math.max(...data.map((item) => item.value))

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-center gap-4 h-64">
        {data.map((item, index) => {
          const height = (item.value / maxValue) * 200
          return (
            <div key={index} className="flex flex-col items-center gap-2">
              <div className="text-xs text-muted-foreground">{item.value}M</div>
              <div
                className="w-16 rounded-t transition-all duration-300 hover:opacity-80"
                style={{
                  height: `${height}px`,
                  backgroundColor: item.color,
                  minHeight: "4px",
                }}
              />
              <div className="text-sm font-medium text-foreground">{item.name}</div>
            </div>
          )
        })}
      </div>
      <div className="text-center">
        <div className="text-xs text-muted-foreground">Volume (Millions)</div>
      </div>
    </div>
  )
}

export default function BlockchainDashboard() {
  const [selectedToken, setSelectedToken] = useState<string>("all")
  const [selectedClassifications, setSelectedClassifications] = useState<string[]>(["Bullish", "Bearish", "Neutral"])
  const [expandedTransactions, setExpandedTransactions] = useState<Set<number>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    console.log("[v0] Statistics data:", statisticsData)
    console.log("[v0] Transactions data length:", transactionsData?.length)
    console.log("[v0] Theme:", theme)
    console.log("[v0] Mounted:", mounted)
  }, [theme, mounted])

  const statistics = statisticsData || {
    sample_size: 0,
    classification: {
      counts: { Bullish: 0, Bearish: 0, Neutral: 0 },
      percentages: { Bullish: 0, Bearish: 0, Neutral: 0 },
    },
    final_verdict: { verdict: "Neutral", bullish_share_pct: 0, bearish_share_pct: 0 },
    amounts_by_class: { Bullish: 0, Bearish: 0, Neutral: 0 },
    unique_tokens_seen: {},
    token_classification_counts: {},
  }

  const transactions = transactionsData || []

  const pieChartData = useMemo(() => {
    const data = [
      {
        name: "Bullish",
        value: statistics.classification.counts.Bullish,
        color: SENTIMENT_COLORS.Bullish,
        percentage: statistics.classification.percentages.Bullish,
      },
      {
        name: "Bearish",
        value: statistics.classification.counts.Bearish,
        color: SENTIMENT_COLORS.Bearish,
        percentage: statistics.classification.percentages.Bearish,
      },
      {
        name: "Neutral",
        value: statistics.classification.counts.Neutral,
        color: SENTIMENT_COLORS.Neutral,
        percentage: statistics.classification.percentages.Neutral,
      },
    ]
    console.log("[v0] Pie chart data:", data)
    return data
  }, [statistics])

  const volumeChartData = useMemo(() => {
    const data = [
      {
        name: "Bullish",
        value: Math.round((statistics.amounts_by_class.Bullish / 1000000) * 100) / 100,
        color: SENTIMENT_COLORS.Bullish,
      },
      {
        name: "Bearish",
        value: Math.round((statistics.amounts_by_class.Bearish / 1000000) * 100) / 100,
        color: SENTIMENT_COLORS.Bearish,
      },
      {
        name: "Neutral",
        value: Math.round((statistics.amounts_by_class.Neutral / 1000000) * 100) / 100,
        color: SENTIMENT_COLORS.Neutral,
      },
    ]
    console.log("[v0] Volume chart data:", data)
    return data
  }, [statistics])

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx: any) => {
      if (!tx?.input_transaction || !tx?.model_output) return false

      const tokenMatch = selectedToken === "all" || tx.input_transaction.token === selectedToken
      const classificationMatch = selectedClassifications.includes(
        tx.model_output.classification.charAt(0).toUpperCase() + tx.model_output.classification.slice(1),
      )
      return tokenMatch && classificationMatch
    })
  }, [selectedToken, selectedClassifications, transactions])

  const totalPages = Math.ceil(filteredTransactions.length / TRANSACTIONS_PER_PAGE)
  const startIndex = (currentPage - 1) * TRANSACTIONS_PER_PAGE
  const endIndex = startIndex + TRANSACTIONS_PER_PAGE
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex)

  useMemo(() => {
    setCurrentPage(1)
  }, [selectedToken, selectedClassifications])

  const toggleTransactionExpansion = (index: number) => {
    const newExpanded = new Set(expandedTransactions)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedTransactions(newExpanded)
  }

  const formatAddress = (address: string) => {
    if (!address) return "N/A"
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "N/A"
    return new Date(timestamp).toLocaleString()
  }

  const getSentimentIcon = (classification: string) => {
    switch (classification?.toLowerCase()) {
      case "bullish":
        return <TrendingUp className="w-4 h-4" />
      case "bearish":
        return <TrendingDown className="w-4 h-4" />
      default:
        return <Minus className="w-4 h-4" />
    }
  }

  const getSentimentBadge = (classification: string) => {
    const sentiment = classification?.charAt(0).toUpperCase() + classification?.slice(1) || "Neutral"
    return (
      <Badge
        variant="outline"
        className="flex items-center gap-1"
        style={{
          borderColor: SENTIMENT_COLORS[sentiment as keyof typeof SENTIMENT_COLORS],
          color: SENTIMENT_COLORS[sentiment as keyof typeof SENTIMENT_COLORS],
        }}
      >
        {getSentimentIcon(classification)}
        {sentiment}
      </Badge>
    )
  }

  const selectedTokenStats = selectedToken !== "all" ? statistics.token_classification_counts[selectedToken] : null

  const handleThemeToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    console.log("[v0] Switching theme from", theme, "to", newTheme)
    setTheme(newTheme)
  }

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={handleThemeToggle}
          className="bg-background border-border hover:bg-accent"
          disabled={!mounted}
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      {statistics.sample_size > 0 ? (
        <>
          <Card className="border-l-4 border-l-green-500 bg-card shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                      <Activity className="w-8 h-8 text-green-600" />
                    </div>
                    <div>
                      <CardTitle className="text-4xl font-bold flex items-center gap-3 text-foreground">
                        Market Verdict: {statistics.final_verdict.verdict}
                        <Badge
                          variant="outline"
                          className="text-lg px-4 py-2 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
                        >
                          {getSentimentIcon(statistics.final_verdict.verdict)}
                          {statistics.final_verdict.verdict}
                        </Badge>
                      </CardTitle>
                      <p className="text-muted-foreground mt-2 text-lg">
                        <span className="text-green-600 font-semibold">{statistics.classification.counts.Bullish}</span>{" "}
                        Bullish,{" "}
                        <span className="text-red-600 font-semibold">{statistics.classification.counts.Bearish}</span>{" "}
                        Bearish,{" "}
                        <span className="text-muted-foreground font-semibold">
                          {statistics.classification.counts.Neutral}
                        </span>{" "}
                        Neutral
                      </p>
                    </div>
                  </div>
                </div>
                <div className="hidden md:flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-500" />
                    <span className="text-sm text-muted-foreground">Live Analysis</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">07/30/2025</div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card shadow-md hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-sm font-medium text-foreground">Total Transactions</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{statistics.sample_size.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Analyzed on-chain</p>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-md hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <CardTitle className="text-sm font-medium text-foreground">Bullish Percentage</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {statistics.classification.percentages.Bullish}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Market optimism</p>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-md hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <CardTitle className="text-sm font-medium text-foreground">Bearish Percentage</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{statistics.classification.percentages.Bearish}%</div>
                <p className="text-xs text-muted-foreground mt-1">Market pessimism</p>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-md hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-sm font-medium text-foreground">Bull/Bear Ratio</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  <span className="text-green-600">{statistics.final_verdict.bullish_share_pct}%</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-red-600">{statistics.final_verdict.bearish_share_pct}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Sentiment ratio</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-card shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Classification Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[350px] flex items-center justify-center">
                  {mounted ? (
                    <PieChart data={pieChartData} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                      <div>
                        <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Loading chart...</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Zap className="w-5 h-5 text-blue-500" />
                  Volume by Sentiment (Millions)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[350px] flex items-center justify-center">
                  {mounted ? (
                    <BarChart data={volumeChartData} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                      <div>
                        <Zap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Loading chart...</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Shield className="w-5 h-5 text-blue-500" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block text-foreground">Token</label>
                  <Select value={selectedToken} onValueChange={setSelectedToken}>
                    <SelectTrigger className="bg-card border-border">
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tokens</SelectItem>
                      {Object.entries(statistics.unique_tokens_seen).map(([token, count]) => (
                        <SelectItem key={token} value={token}>
                          {token} ({count} txns)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block text-foreground">Classifications</label>
                  <div className="flex gap-4">
                    {["Bullish", "Bearish", "Neutral"].map((classification) => (
                      <div key={classification} className="flex items-center space-x-2">
                        <Checkbox
                          id={classification}
                          checked={selectedClassifications.includes(classification)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedClassifications([...selectedClassifications, classification])
                            } else {
                              setSelectedClassifications(selectedClassifications.filter((c) => c !== classification))
                            }
                          }}
                          className="border-border data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                        />
                        <label htmlFor={classification} className="text-sm font-medium text-foreground">
                          {classification}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selectedTokenStats && (
                <div className="mt-4 p-4 bg-background rounded-lg border border-border">
                  <h3 className="font-semibold mb-2 text-foreground">{selectedToken} Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total:</span>{" "}
                      <span className="text-foreground font-medium">{selectedTokenStats.total}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bullish:</span>{" "}
                      <span className="text-green-600 font-medium">{selectedTokenStats.Bullish}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bearish:</span>{" "}
                      <span className="text-red-600 font-medium">{selectedTokenStats.Bearish}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Neutral:</span>{" "}
                      <span className="text-muted-foreground font-medium">{selectedTokenStats.Neutral}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Transaction Feed ({filteredTransactions.length} transactions)
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {paginatedTransactions.map((transaction: any) => (
                  <div
                    key={transaction.index}
                    className="border border-border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-sm text-muted-foreground">Timestamp</div>
                          <div className="font-mono text-sm text-foreground">
                            {formatTimestamp(transaction.input_transaction.timestamp)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Token & Amount</div>
                          <div className="font-semibold text-foreground">
                            <span className="text-blue-600">{transaction.input_transaction.token}</span> -{" "}
                            {transaction.input_transaction.amount.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">From → To</div>
                          <div className="font-mono text-sm text-foreground">
                            {formatAddress(transaction.input_transaction.from)} →{" "}
                            {formatAddress(transaction.input_transaction.to)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-muted-foreground">Classification</div>
                          <div className="flex items-center gap-2">
                            {getSentimentBadge(transaction.model_output.classification)}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleTransactionExpansion(transaction.index)}
                        className="hover:bg-blue-50 hover:text-blue-600"
                      >
                        {expandedTransactions.has(transaction.index) ? <ChevronUp /> : <ChevronDown />}
                      </Button>
                    </div>

                    <div className="mt-2 flex gap-2">
                      {transaction.input_transaction.is_swap && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                          🔄 Swap
                        </Badge>
                      )}
                      {transaction.input_transaction.is_liquidity_add && (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
                          💧 Liquidity Add
                        </Badge>
                      )}
                      {transaction.input_transaction.is_liquidity_remove && (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">
                          🔻 Liquidity Remove
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2">
                      <div className="text-sm text-muted-foreground">Market Impact</div>
                      <div className="text-sm text-foreground">{transaction.model_output.market_impact}</div>
                    </div>

                    {expandedTransactions.has(transaction.index) && (
                      <div className="mt-4 p-3 bg-background dark:bg-card rounded border border-border">
                        <div className="text-sm text-muted-foreground mb-1">Reasoning</div>
                        <div className="text-sm text-foreground">{transaction.model_output.reasoning}</div>
                        <div className="text-xs text-muted-foreground mt-2 font-mono">
                          Transaction Hash: {transaction.tx_hash}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of{" "}
                    {filteredTransactions.length} transactions
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="bg-card shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p>Please ensure the data files are properly loaded.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
