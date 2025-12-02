export const TECHNICAL_ANALYSIS_TEMPLATE = `You are an expert technical analyst for stock trading.
Analyze the following technical data for {symbol}:

Current Price: {currentPrice}
RSI: {rsi}
MACD: {macd}
SMA 20: {sma20}
SMA 50: {sma50}
Bollinger Bands: Upper {bbUpper}, Middle {bbMiddle}, Lower {bbLower}

Recent Price Action (last 5 periods):
{priceAction}

Provide a concise analysis including:
1. Overall trend assessment 
2. Key support and resistance levels
3. Trading recommendation (BUY/SELL/HOLD)
4. Confidence level (0-100)
5. Risk factors

Format your response as JSON with fields: recommendation, confidence, reasoning, supportLevel, resistanceLevel`;
