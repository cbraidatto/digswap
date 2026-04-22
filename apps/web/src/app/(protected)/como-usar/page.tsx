import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Como Usar — DigSwap",
	description:
		"Aprenda a usar o DigSwap: importe sua coleção, descubra matches, troque vinis, e organize sua biblioteca local com IA.",
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
			"Cadastre-se com email e senha, ou entre com Google/GitHub. Ative autenticação em dois fatores (2FA) para proteger sua conta com um app autenticador.",
		tip: "Use uma senha forte — o DigSwap exige pelo menos 8 caracteres com maiúscula, número e caractere especial.",
	},
	{
		icon: "link",
		title: "2. Conecte o Discogs",
		description:
			"No onboarding, conecte sua conta do Discogs via OAuth para importar automaticamente toda a sua coleção e wantlist. A importação roda em background — você pode usar o app enquanto ela acontece.",
		tip: "Coleções com mais de 1.000 discos podem levar alguns minutos. Acompanhe o progresso em tempo real no banner do topo.",
	},
	{
		icon: "edit",
		title: "3. Configure seu perfil",
		description:
			"Escolha um nome de exibição, username, foto de perfil, banner de capa e bio. Adicione links das suas redes sociais (YouTube, Instagram, SoundCloud, Discogs, Beatport). Outros diggers vão te encontrar pelo seu username.",
	},
];

const COLLECTION_GEMS: TutorialStep[] = [
	{
		icon: "diamond",
		title: "Gemas & Raridade",
		description:
			"Cada disco na sua coleção recebe uma classificação de gema baseada na raridade real do mercado (dados Discogs have/want). São 6 tiers: Quartzo (comum), Ágata, Jade, Safira, Rubi e Diamante (ultra-raro). A classificação flutua conforme o mercado muda.",
		tip: "Seu Gem Score total determina seu ranking na comunidade. Discos raros valem muito mais pontos.",
	},
	{
		icon: "album",
		title: "Sua Coleção",
		description:
			"Veja todos os seus discos com badge de gema, filtro por gênero, década, país e formato, e ordenação por raridade, data ou A-Z. Adicione discos manualmente buscando no catálogo do Discogs. Defina a condição física de cada disco (Mint a Poor).",
		tip: 'Use o filtro de formato para separar LPs de 7" e 12". Combine filtros para encontrar exatamente o que procura.',
	},
	{
		icon: "visibility",
		title: "Visibilidade de Coleção",
		description:
			"Controle quais discos estão disponíveis para trade. Cada item pode ser marcado como 'Disponível para trade', 'Não negociável' ou 'Privado'. Itens privados não aparecem no perfil público.",
	},
	{
		icon: "compare",
		title: "Comparar Coleções",
		description:
			"Visite o perfil de outro digger e compare coleções lado a lado: veja o que vocês têm em comum (verde), o que só você tem (azul), e o que só o outro tem (laranja). Ótimo para descobrir oportunidades de trade.",
	},
];

const DISCOVERY: TutorialStep[] = [
	{
		icon: "radar",
		title: "Radar",
		description:
			"O Radar cruza sua wantlist com as coleções de todos os usuários e mostra quem tem o que você quer. Filtre por tier de gema e veja em tempo real quando novos matches aparecem. É o coração do DigSwap.",
		tip: "O Radar aparece direto no feed — você não precisa ir procurar. Novos matches geram notificação automática.",
	},
	{
		icon: "explore",
		title: "Explorar",
		description:
			"Descubra discos por gênero, década, país e formato. Busque por título ou artista. Veja o ranking global dos diggers mais raros e os reviews mais recentes da comunidade.",
	},
	{
		icon: "library_music",
		title: "Páginas de Release",
		description:
			"Cada disco tem uma página pública com capa, informações detalhadas, link pro Discogs, vídeo do YouTube, lista de quem tem na coleção, e reviews da comunidade. Essas páginas são indexadas por buscadores.",
	},
	{
		icon: "notifications",
		title: "Notificações",
		description:
			"Receba alertas em tempo real quando: alguém adiciona um disco da sua wantlist, você recebe um trade request, ganha um badge, ou alguém posta no seu grupo. Notificações por email para eventos importantes (configurável).",
	},
];

const COMMUNITY_SOCIAL: TutorialStep[] = [
	{
		icon: "group",
		title: "Grupos por Gênero",
		description:
			"Crie ou entre em grupos organizados por gênero musical (Jazz, Funk, House, MPB, etc). Publique posts, compartilhe achados, e descubra diggers com gosto parecido.",
		tip: "Grupos privados só aceitam membros com convite — peça o link ao admin do grupo.",
	},
	{
		icon: "rate_review",
		title: "Reviews de Discos",
		description:
			"Avalie qualquer disco com 1 a 5 estrelas e escreva um review dentro dos grupos. Reviews aparecem na página pública do release e no feed dos membros.",
	},
	{
		icon: "chat",
		title: "Chat Direto",
		description:
			"Converse em tempo real com seus amigos — seguidores mútuos (você segue e a pessoa te segue de volta). O ícone de chat fica no topo da tela. Mensagens dentro de trades ficam no thread do trade.",
	},
	{
		icon: "dynamic_feed",
		title: "Feed Social",
		description:
			"Seu feed mostra atividades dos diggers que você segue: novos discos adicionados, reviews publicados, posts em grupos, e badges conquistados. O Radar aparece integrado no topo do feed.",
	},
];

const TRADES: TutorialStep[] = [
	{
		icon: "swap_horiz",
		title: "Propostas de Trade",
		description:
			"Encontrou alguém com o disco que você quer? Monte uma proposta selecionando discos do seu acervo e do outro digger, lado a lado. Defina a qualidade e condição de cada item. O outro pode aceitar, recusar, ou enviar uma contraproposta modificando os itens.",
		tip: "Contrapropostas funcionam como negociação: cada rodada pode ajustar itens e qualidade até ambos concordarem.",
	},
	{
		icon: "desktop_windows",
		title: "Transferência P2P (Desktop)",
		description:
			"A troca de arquivos de áudio acontece exclusivamente pelo app desktop via conexão peer-to-peer (WebRTC). Nenhum arquivo passa por servidores — direto do seu computador para o do outro digger. Inclui preview de 1 minuto antes da transferência completa.",
	},
	{
		icon: "workspace_premium",
		title: "Planos & Limites",
		description:
			"A conta gratuita tem 5 trades por mês. Premium desbloqueia trades ilimitados, análises avançadas, e badges exclusivos. Gerencie sua assinatura em Configurações > Plano.",
		tip: "Você pode ver quanto resta da sua cota direto na tela de trades.",
	},
];

const DESKTOP_APP: TutorialStep[] = [
	{
		icon: "folder_open",
		title: "Biblioteca Local",
		description:
			"Selecione uma pasta do seu computador e o app escaneia todos os arquivos de áudio (FLAC, WAV, AIFF). Metadados são extraídos das tags ID3/Vorbis e também inferidos da estrutura de pastas e nomes de arquivo quando as tags estão incompletas.",
	},
	{
		icon: "auto_awesome",
		title: "Enriquecimento com IA",
		description:
			"Arquivos com tags ruins ou incompletas podem ser enriquecidos automaticamente com Gemini Flash. A IA analisa o caminho do arquivo, tags parciais e contexto para inferir artista, álbum e faixa. Campos inferidos por IA mostram um badge de centelha. Você pode corrigir qualquer campo manualmente e sua edição nunca será sobrescrita.",
		tip: "Configure sua chave da API Gemini em Configurações no app desktop. A primeira vez que clicar em 'Enriquecer IA' ele pede a chave.",
	},
	{
		icon: "sync",
		title: "Sync com a Web",
		description:
			"Sua biblioteca local sincroniza automaticamente com o DigSwap web. Os discos aparecem no seu perfil como itens 'local' ao lado dos importados do Discogs. Se um disco local combina com um release do Discogs, ele é vinculado automaticamente sem duplicar.",
	},
	{
		icon: "dock_to_bottom",
		title: "Daemon no Tray",
		description:
			"O app desktop roda em segundo plano no system tray. Fechar a janela minimiza pro tray em vez de encerrar. Um file watcher monitora sua pasta de música em tempo real — novos arquivos ou remoções são detectados automaticamente e sincronizados. Opção de iniciar com o Windows.",
		tip: "O ícone no tray tem menu com 'Abrir' e 'Encerrar'. Duplo clique no ícone reabre a janela.",
	},
];

const PROFILE_ACHIEVEMENTS: TutorialStep[] = [
	{
		icon: "account_balance",
		title: "Gem Vault",
		description:
			"Seu perfil exibe a distribuição das suas gemas em uma barra visual (quantos discos em cada tier). Seu Gem Score total e ranking são calculados com peso por tier — um Diamante vale muito mais que vários Quartzo.",
	},
	{
		icon: "fingerprint",
		title: "Digger DNA",
		description:
			"Análise automática da sua coleção: seus gêneros mais colecionados, décadas preferidas, países de origem, e distribuição de raridade. Atualiza conforme sua coleção cresce. Aparece como um radar chart no seu perfil.",
	},
	{
		icon: "military_tech",
		title: "Rankings & Badges",
		description:
			"Suba no ranking global e por gênero. Conquiste badges como First Dig (primeiro disco), Century Club (100 discos), Rare Find (disco ultra-raro), Critic (primeiro review), e outros. Badges aparecem no seu perfil.",
	},
	{
		icon: "auto_awesome",
		title: "Showcase & Year in Crates",
		description:
			"Destaque 3 discos como seus Holy Grails no perfil. No final do ano, veja seu Year in Crates: quantos discos adicionou, reviews escritos, gêneros mais ouvidos, achado mais raro, e evolução da coleção.",
	},
];

const TOOLS: TutorialStep[] = [
	{
		icon: "inventory_2",
		title: "Crates & Sets",
		description:
			"Organize discos em crates (engradados) temáticos — perfeito para preparar sets de DJ ou organizar por mood. Dentro de cada crate, crie sets com ordem de faixas personalizada e metadados de evento.",
	},
	{
		icon: "play_circle",
		title: "Player YouTube",
		description:
			"Discos com vídeo no YouTube podem ser tocados direto no app. O player flutuante aparece na parte inferior da tela com controles de play/pause e fila de reprodução.",
	},
	{
		icon: "settings",
		title: "Configurações",
		description:
			"Gerencie seu perfil, conexão Discogs (sync, desconectar, reimportar), preferências de notificação, sessões ativas, 2FA, e assinatura Premium. Tudo em um lugar.",
		tip: "Você pode ter até 3 sessões ativas simultaneamente. Encerre sessões antigas em Configurações > Sessões.",
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
					O DigSwap é uma rede social para vinyl diggers. Importe sua coleção do Discogs ou escaneie
					sua biblioteca local, descubra quem tem os discos que você procura, e conecte-se com a
					comunidade. O app desktop permite troca de arquivos via P2P e enriquecimento de metadados
					com IA.
				</p>
			</div>

			<Section title="Primeiros Passos" icon="rocket_launch">
				{GETTING_STARTED.map((step) => (
					<StepCard key={step.title} step={step} />
				))}
			</Section>

			<Section title="Coleção & Gemas" icon="diamond">
				{COLLECTION_GEMS.map((step) => (
					<StepCard key={step.title} step={step} />
				))}
			</Section>

			<Section title="Descoberta & Radar" icon="radar">
				{DISCOVERY.map((step) => (
					<StepCard key={step.title} step={step} />
				))}
			</Section>

			<Section title="Comunidade & Social" icon="forum">
				{COMMUNITY_SOCIAL.map((step) => (
					<StepCard key={step.title} step={step} />
				))}
			</Section>

			<Section title="Trades" icon="swap_horiz">
				{TRADES.map((step) => (
					<StepCard key={step.title} step={step} />
				))}
			</Section>

			<Section title="App Desktop" icon="desktop_windows">
				{DESKTOP_APP.map((step) => (
					<StepCard key={step.title} step={step} />
				))}
			</Section>

			<Section title="Perfil & Conquistas" icon="emoji_events">
				{PROFILE_ACHIEVEMENTS.map((step) => (
					<StepCard key={step.title} step={step} />
				))}
			</Section>

			<Section title="Ferramentas" icon="build">
				{TOOLS.map((step) => (
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
