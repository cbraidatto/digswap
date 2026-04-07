import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Como Usar — DigSwap",
	description:
		"Aprenda a usar o DigSwap: importe sua coleção, descubra matches, e troque vinis com outros diggers.",
};

// ---------------------------------------------------------------------------
// Step data
// ---------------------------------------------------------------------------

interface TutorialStep {
	icon: string;
	title: string;
	description: string;
	tip?: string;
}

const GETTING_STARTED: TutorialStep[] = [
	{
		icon: "person_add",
		title: "1. Crie sua conta",
		description:
			"Cadastre-se com email e senha. Você pode ativar autenticação em dois fatores (2FA) para proteger sua conta.",
		tip: "Use uma senha forte — o DigSwap exige pelo menos 8 caracteres com letras e números.",
	},
	{
		icon: "link",
		title: "2. Conecte o Discogs",
		description:
			"No onboarding, conecte sua conta do Discogs para importar automaticamente toda a sua coleção e wantlist. A importação roda em background — você pode usar o app enquanto ela acontece.",
		tip: "Coleções com mais de 1.000 discos podem levar alguns minutos para importar.",
	},
	{
		icon: "edit",
		title: "3. Configure seu perfil",
		description:
			"Escolha um nome de exibição, adicione uma foto e uma bio. Outros diggers vão te encontrar pelo seu username.",
	},
];

const CORE_FEATURES: TutorialStep[] = [
	{
		icon: "album",
		title: "Sua Coleção",
		description:
			"Veja todos os seus discos organizados por raridade, gênero ou data. Cada disco mostra um score de raridade baseado nos dados do Discogs. Você pode adicionar discos manualmente buscando no catálogo do Discogs.",
		tip: 'Use o filtro de formato para separar LPs de 7" e 12".',
	},
	{
		icon: "favorite",
		title: "Wantlist & Radar",
		description:
			"Sua wantlist mostra os discos que você está procurando. O Radar cruza sua wantlist com as coleções de outros usuários e mostra quem tem o que você quer — com filtro por raridade.",
		tip: "Adicione discos à wantlist direto da página de um release ou pelo YouTube.",
	},
	{
		icon: "explore",
		title: "Explorar",
		description:
			"Descubra discos por gênero, década, país e formato. Busque por título ou artista. Veja quem tem cada disco e quantas pessoas estão procurando.",
	},
	{
		icon: "swap_horiz",
		title: "Trades",
		description:
			"Encontrou alguém com o disco que você quer? Inicie um trade! Na versão gratuita você tem 5 trades por mês. Premium é ilimitado. Mensagens ficam no thread do trade.",
		tip: "O trade de arquivos de áudio acontece via P2P no app desktop — sem servidor intermediário.",
	},
	{
		icon: "group",
		title: "Comunidade",
		description:
			"Crie ou entre em grupos por gênero musical. Publique posts, faça reviews de discos (1-5 estrelas), e descubra diggers com gosto parecido.",
		tip: "Grupos privados só aceitam membros com convite — peça ao admin.",
	},
	{
		icon: "chat",
		title: "Chat Direto",
		description:
			"Converse em tempo real com seus amigos — seguidores mútuos (você segue e a pessoa te segue de volta). O ícone de chat fica no topo da tela.",
	},
];

const PROFILE_FEATURES: TutorialStep[] = [
	{
		icon: "diamond",
		title: "Showcase & Holy Grails",
		description:
			"Destaque 3 discos como seus Holy Grails e configure cards de showcase (buscando, mais raro, favorito) que aparecem no seu perfil.",
	},
	{
		icon: "fingerprint",
		title: "Digger DNA",
		description:
			"Uma análise automática da sua coleção: seus gêneros mais ouvidos, décadas preferidas, países de origem, e perfil de raridade. Atualiza conforme sua coleção cresce.",
	},
	{
		icon: "leaderboard",
		title: "Rankings & Badges",
		description:
			"Suba no ranking global e por gênero. Conquiste badges como First Dig (primeiro disco), Century Club (100 discos), Rare Find (disco ultra-raro), e Critic (primeiro review).",
	},
	{
		icon: "auto_awesome",
		title: "Year in Crates",
		description:
			"No final do ano, veja um resumo da sua jornada: quantos discos adicionou, reviews escritos, gêneros mais ouvidos, e seu achado mais raro.",
	},
];

const ADVANCED_FEATURES: TutorialStep[] = [
	{
		icon: "inventory_2",
		title: "Crates & Sets",
		description:
			"Organize discos em crates (engradados) — perfeito para preparar sets de DJ. Dentro de cada crate, crie sets com ordem de faixas personalizada.",
	},
	{
		icon: "play_circle",
		title: "Player de Música",
		description:
			"Discos com vídeo no YouTube podem ser tocados direto no app. O player flutuante aparece na parte inferior da tela com controles de play, pause, próximo e fila de reprodução.",
	},
	{
		icon: "compare",
		title: "Comparar Coleções",
		description:
			"Visite o perfil de outro digger e compare coleções: veja o que vocês têm em comum e quais discos da wantlist de um estão na coleção do outro.",
	},
	{
		icon: "notifications",
		title: "Notificações",
		description:
			"Receba alertas quando alguém adiciona um disco da sua wantlist à coleção, quando recebe um trade request, ou quando ganha um badge. Configure preferências em Configurações.",
	},
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function StepCard({ step }: { step: TutorialStep }) {
	return (
		<div className="flex gap-4 p-4 rounded-lg bg-surface-container-low border border-outline-variant/10 hover:border-primary/20 transition-colors">
			<div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
				<span className="material-symbols-outlined text-xl text-primary">{step.icon}</span>
			</div>
			<div className="flex-1 min-w-0">
				<h3 className="font-heading text-sm font-bold text-on-surface mb-1">{step.title}</h3>
				<p className="font-mono text-xs text-on-surface-variant leading-relaxed">
					{step.description}
				</p>
				{step.tip && (
					<div className="mt-2 flex items-start gap-1.5 bg-primary/5 rounded px-2 py-1.5">
						<span className="material-symbols-outlined text-xs text-primary flex-shrink-0 mt-0.5">
							lightbulb
						</span>
						<span className="font-mono text-[10px] text-primary leading-relaxed">{step.tip}</span>
					</div>
				)}
			</div>
		</div>
	);
}

function Section({
	title,
	icon,
	children,
}: {
	title: string;
	icon: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mb-10">
			<div className="flex items-center gap-2 mb-4">
				<span className="material-symbols-outlined text-lg text-primary">{icon}</span>
				<h2 className="font-heading text-lg font-bold text-on-surface uppercase tracking-tight">
					{title}
				</h2>
			</div>
			<div className="space-y-3">{children}</div>
		</section>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ComoUsarPage() {
	return (
		<div className="max-w-2xl mx-auto px-4 py-8">
			{/* Header */}
			<div className="mb-10">
				<Link
					href="/feed"
					className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-primary font-mono text-xs mb-4 transition-colors"
				>
					<span className="material-symbols-outlined text-sm">arrow_back</span>
					Voltar
				</Link>

				<div className="flex items-center gap-3 mb-3">
					<div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
						<span className="material-symbols-outlined text-2xl text-primary">menu_book</span>
					</div>
					<div>
						<h1 className="font-heading text-2xl font-extrabold text-on-surface">
							Como Usar o DigSwap
						</h1>
						<p className="font-mono text-xs text-on-surface-variant">Guia completo da plataforma</p>
					</div>
				</div>

				<p className="font-mono text-xs text-on-surface-variant leading-relaxed max-w-lg">
					O DigSwap é uma rede social para vinyl diggers. Importe sua coleção do Discogs, descubra
					quem tem os discos que você procura, e conecte-se com a comunidade.
				</p>
			</div>

			{/* Getting Started */}
			<Section title="Primeiros Passos" icon="rocket_launch">
				{GETTING_STARTED.map((step) => (
					<StepCard key={step.title} step={step} />
				))}
			</Section>

			{/* Core Features */}
			<Section title="Funcionalidades Principais" icon="apps">
				{CORE_FEATURES.map((step) => (
					<StepCard key={step.title} step={step} />
				))}
			</Section>

			{/* Profile */}
			<Section title="Seu Perfil" icon="person">
				{PROFILE_FEATURES.map((step) => (
					<StepCard key={step.title} step={step} />
				))}
			</Section>

			{/* Advanced */}
			<Section title="Ferramentas Avançadas" icon="build">
				{ADVANCED_FEATURES.map((step) => (
					<StepCard key={step.title} step={step} />
				))}
			</Section>

			{/* Help footer */}
			<div className="mt-12 mb-8 text-center border-t border-outline-variant/10 pt-8">
				<span className="material-symbols-outlined text-3xl text-on-surface-variant/30 block mb-2">
					support
				</span>
				<p className="font-mono text-xs text-on-surface-variant">
					Ainda tem dúvidas? Entre em um grupo na{" "}
					<Link href="/comunidade" className="text-primary hover:underline">
						comunidade
					</Link>{" "}
					e pergunte para outros diggers.
				</p>
			</div>
		</div>
	);
}
