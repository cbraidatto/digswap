import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "DigSwap — The social network for vinyl diggers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
	return new ImageResponse(
		<div
			style={{
				width: "1200px",
				height: "630px",
				backgroundColor: "#10141a",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "60px 80px",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			{/* Subtle border */}
			<div
				style={{
					position: "absolute",
					inset: "16px",
					border: "1px solid rgba(255,255,255,0.06)",
					borderRadius: "16px",
					display: "flex",
				}}
			/>

			{/* Logo */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "12px",
					marginBottom: "40px",
				}}
			>
				<div
					style={{
						width: "48px",
						height: "48px",
						borderRadius: "50%",
						backgroundColor: "rgba(166,227,161,0.15)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: "24px",
					}}
				>
					💿
				</div>
				<span
					style={{
						fontSize: "28px",
						fontWeight: 700,
						color: "#dfe2eb",
						letterSpacing: "-0.02em",
					}}
				>
					DIGSWAP
				</span>
			</div>

			{/* Headline */}
			<div
				style={{
					fontSize: "56px",
					fontWeight: 800,
					color: "#dfe2eb",
					textAlign: "center",
					lineHeight: 1.1,
					letterSpacing: "-0.03em",
					maxWidth: "900px",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
				}}
			>
				<span>Find who has the record</span>
				<span style={{ color: "#a6e3a1" }}>you&apos;ve been hunting</span>
			</div>

			{/* Subtitle */}
			<div
				style={{
					fontSize: "22px",
					color: "rgba(223,226,235,0.5)",
					marginTop: "24px",
					textAlign: "center",
					display: "flex",
				}}
			>
				The social network for vinyl diggers
			</div>

			{/* Feature pills */}
			<div
				style={{
					display: "flex",
					gap: "16px",
					marginTop: "40px",
				}}
			>
				{["Wantlist Radar", "Rarity Scores", "Digger Community"].map((label) => (
					<div
						key={label}
						style={{
							padding: "8px 20px",
							borderRadius: "20px",
							border: "1px solid rgba(166,227,161,0.2)",
							backgroundColor: "rgba(166,227,161,0.05)",
							color: "#a6e3a1",
							fontSize: "16px",
							fontWeight: 500,
							display: "flex",
						}}
					>
						{label}
					</div>
				))}
			</div>
		</div>,
		{ ...size },
	);
}
