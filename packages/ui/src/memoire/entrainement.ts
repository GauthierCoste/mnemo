/**
 * Ce que la page Mémoire › Entraîner dit de l'état de l'entraînement, en fonctions pures : le ton de la puce d'un état, le
 * verdict du service sans son premier mot, les niveaux regroupés quand ils disent la même chose, l'étape utile, les dates
 * et l'avancement. Les phrases sont dans la liste de textes (`t.memoire.entrainer`) ; le français par défaut pour un
 * appelant sans langue. Vocabulaire (spec, D9) : « note de confiance », « injecter ».
 */
import type { AvancementNoteVue, EtatNoteVue, NiveauNoteVue, NoteDuNiveauVue, VueEntrainement } from '@mnemo/contrat';
import { TEXTES, type Textes } from '../langue/textes.ts';

export type TextesEntrainer = Textes['memoire']['entrainer'];
const FR: TextesEntrainer = TEXTES.fr.memoire.entrainer;

/** Messages validés conseillés pour un premier apprentissage (la jauge de « Préparer »). */
export const MESSAGES_CONSEILLES = 100;
/** Messages préparés par défaut (comme le service). */
export const NOMBRE_A_PREPARER = 30;
export const PREPARER_MAX = 200;

export type TonEtat = 'succes' | 'avertissement' | 'neutre';
export const TONS_ETATS_NOTE: Record<EtatNoteVue, TonEtat> = { accepte: 'succes', coupe: 'avertissement', refuse: 'avertissement', depart: 'neutre', non_appris: 'neutre' };

/**
 * Le verdict du service (« Refusé : la note ordonne le classement, sans % ») sans ce qui précède le premier « : », que la
 * puce dit déjà ; avec une majuscule. Sans « : », tel quel. Le verdict est un texte du service, en français.
 */
export function suiteDuVerdict(verdict: string): string {
	const i = verdict.indexOf(' : ');
	if (i < 0) return verdict;
	const suite = verdict.slice(i + 3).trim();
	return suite.charAt(0).toUpperCase() + suite.slice(1);
}

/** Une ligne de l'en-tête : un ou plusieurs niveaux qui ont le même état, la même origine, la même date et le même verdict. */
export type LigneDeNote = { niveaux: NiveauNoteVue[]; note: NoteDuNiveauVue };

/** Les niveaux regroupés : « Complets et Sens seul » quand ils disent la même chose, sinon une ligne chacun. */
export function lignesDeNote(niveaux: readonly NoteDuNiveauVue[]): LigneDeNote[] {
	const lignes: LigneDeNote[] = [];
	for (const n of niveaux) {
		const meme = lignes.find((l) => l.note.etat === n.etat && l.note.origine === n.origine && l.note.date === n.date && l.note.verdict === n.verdict);
		if (meme) meme.niveaux.push(n.niveau);
		else lignes.push({ niveaux: [n.niveau], note: n });
	}
	return lignes;
}

export const nomsDesNiveaux = (niveaux: readonly NiveauNoteVue[], t: TextesEntrainer = FR): string => t.nomsDesNiveaux(niveaux.map((n) => t.niveaux[n]));

/** Date et heure courtes : « 26/11/2026 à 14:05 » ; « — » pour une date illisible. */
export function dateEtHeure(iso: string, t: TextesEntrainer = FR): string {
	const ms = Date.parse(iso);
	return Number.isNaN(ms) ? t.sansValeur : t.dateEtHeure(ms);
}

/** D'où vient la note, à côté de son état : apprise (et quand), livrée avec Mnemo, ou rien. */
export function origineDeNote(n: NoteDuNiveauVue, t: TextesEntrainer = FR): string | null {
	if (n.origine === 'depart') return t.livreeAvecMnemo;
	if (n.origine === 'appris' && n.date !== null) return t.apprise(dateEtHeure(n.date, t));
	return null;
}

export type Etape = 1 | 2 | 3;

/**
 * L'étape à mettre en avant : rien de préparé → Préparer ; des messages attendent un jugement → Juger ; tout est jugé et des
 * messages ont été jugés depuis le dernier apprentissage (ou il n'y en a pas eu) → Apprendre ; sinon, préparer d'autres messages.
 */
export function etapeUtile(v: Pick<VueEntrainement, 'banc'>): Etape {
	const b = v.banc;
	if (b.messages === 0) return 1;
	if (b.aJuger > 0) return 2;
	if (b.paires > 0 && b.nouveauxDepuisApprentissage > 0) return 3;
	return 1;
}

/** Vrai si la note a déjà été apprise sur cette mémoire : un essai réussi dans l'historique, un rapport, ou un modèle appris. */
export const dejaAppris = (v: Pick<VueEntrainement, 'historique' | 'resultat' | 'note'>): boolean =>
	v.resultat !== null || v.historique.some((l) => l.erreur === undefined) || v.note.niveaux.some((n) => n.origine === 'appris');

/** Les messages jugés depuis le dernier apprentissage, dits sur la carte Apprendre (null : jamais appris, rien de plus à dire). */
export function jugesDepuisApprentissage(v: Pick<VueEntrainement, 'banc' | 'historique' | 'resultat' | 'note'>, t: TextesEntrainer = FR): string | null {
	if (!dejaAppris(v)) return null;
	return t.jugesDepuisApprentissage(v.banc.nouveauxDepuisApprentissage);
}

/** Seuil d'injection dit quand le service n'en a pas mesuré. */
const SEUIL_PAR_DEFAUT = 0.9;

/**
 * Les textes du bandeau d'avancement (page Entraîner) : libellé et son explication, pourcentage (« — » sans apprentissage),
 * écart, puis les volumes (nom, fait, cible, infobulle) ou, volume atteint, le critère de qualité qui manque.
 */
export function textesAvancement(
	a: AvancementNoteVue,
	t: TextesEntrainer = FR,
): {
	explication: string;
	pourcentage: string;
	ecart: { texte: string; titre: string } | null;
	volumes: { nom: string; fait: number; cible: number; titre: string }[];
	qualite: string | null;
	sansApprentissage: boolean;
} {
	const ta = t.avancement;
	const seuil = t.pourcent(a.seuil ?? SEUIL_PAR_DEFAUT);
	const parNiveau = a.parNiveau.length > 1 ? a.parNiveau.map((n) => ta.partDuNiveau(t.niveaux[n.niveau], t.pourcent(n.part))) : [];
	const explication = a.part === null ? ta.explicationSansApprentissage : ta.explication(seuil, parNiveau);
	const depuis = a.ecart === null ? NaN : Date.parse(a.ecart.depuis);
	const ecart =
		a.ecart === null
			? null
			: {
					texte: a.ecart.points === 0 ? ta.inchange(depuis) : ta.ecart(a.ecart.points, depuis),
					titre: ta.ecartTitre(dateEtHeure(a.ecart.depuis, t)),
				};
	const volumes =
		a.part !== null && a.part >= 1
			? []
			: a.volumes.map((v) => ({
					nom: ta.volumes[v.nom],
					fait: v.fait,
					cible: v.cible,
					titre: ta.sensDesVolumes[v.nom](v.cible, seuil) + (v.sessions === undefined ? '' : ta.venusDeSessions(v.sessions.fait, v.sessions.cible)),
				}));
	return {
		explication,
		pourcentage: a.part === null ? t.sansValeur : t.pourcent(a.part),
		ecart,
		volumes,
		// `qualite` : la phrase entière, avec le critère du service quand il en donne un
		qualite: a.part !== null && a.part >= 1 ? (a.qualite === null ? ta.volumeAtteintResteQualite : ta.qualite(a.qualite)) : null,
		sansApprentissage: a.part === null,
	};
}
