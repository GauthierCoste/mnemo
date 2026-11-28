// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DonneesGraphe, FicheGraphe } from '@mnemo/contrat';
import { Application } from '../../src/composants/Application.tsx';
import { appliquerAccent } from '../../src/reglages/accent.ts';
import type { GraphePrepare, Noeud } from '../../src/graphe/donnees.ts';
import type { RappelsScene, SceneGraphe } from '../../src/graphe/scene.ts';
import { jetonsDeLaFeuille } from '../aides/couleurs-graphe.ts';
import { creerFauxClient } from '../aides/faux-client.tsx';

// La vraie scène (WebGL absent sous happy-dom) ou une scène simulée, selon le test.
const simulee = vi.hoisted(() => ({ active: false, scene: null as unknown, rappels: null as unknown }));
vi.mock('../../src/graphe/scene.ts', async (importOriginal) => {
	const reel = await importOriginal<typeof import('../../src/graphe/scene.ts')>();
	return {
		...reel,
		creerSceneGraphe: (o: Parameters<typeof reel.creerSceneGraphe>[0]) => {
			if (!simulee.active) return reel.creerSceneGraphe(o);
			simulee.rappels = o.rappels;
			return simulee.scene;
		},
	};
});

// `creerSimulation` réel, espionné : les nœuds disposés se lisent dans ses appels.
const disposition = vi.hoisted(() => ({ creerSimulation: null as unknown as ReturnType<typeof vi.fn> }));
vi.mock('../../src/graphe/disposition.ts', async (importOriginal) => {
	const reel = await importOriginal<typeof import('../../src/graphe/disposition.ts')>();
	disposition.creerSimulation = vi.fn(reel.creerSimulation);
	return { ...reel, creerSimulation: disposition.creerSimulation };
});

function sceneSimulee(): { [K in keyof SceneGraphe]: ReturnType<typeof vi.fn> } {
	return {
		charger: vi.fn(),
		appliquer: vi.fn(),
		disposer: vi.fn(),
		recadrer: vi.fn(),
		centrerSur: vi.fn(),
		densiteEtiquettes: vi.fn(),
		libererEpingles: vi.fn(),
		rotation: vi.fn(),
		majCouleurs: vi.fn(),
		demander: vi.fn(),
		detruire: vi.fn(),
	};
}

function fiche(chemin: string, branche: string): FicheGraphe {
	const titre = chemin.split('/').pop()!.replace(/\.md$/, '');
	return { chemin, titre, type: 'sujet', alias: [], etats: [], faitsActifs: 1, categories: {}, dates: [], branche, parent: null };
}

const GRAPHE: DonneesGraphe = {
	coffre: '_mnemo',
	fiches: [fiche('projets/Module stocks.md', 'projets'), fiche('personnes/Marc Lefèvre.md', 'personnes')],
	liens: [{ source: 'personnes/Marc Lefèvre.md', cible: 'projets/Module stocks.md', cibleEcrite: 'Module stocks', relation: 'valide' }],
	notions: [],
	sens: { disponible: false, etat: 'absent' },
	modifieeMs: 1,
};

function reponses(graphe: DonneesGraphe = GRAPHE) {
	return {
		'/api/sessions': { sessions: [] },
		'/api/sante': { ok: true, pid: 1, racine: '~/Developer', racineAbsolue: '/Users/ana/Developer', terminaux: { ok: true }, version: '0.1.0' },
		'/api/fil': { commits: [], aConfirmer: [], montees: [], modifications: [] },
		'/api/memoire/graphe': graphe,
		'/api/memoire/fiche': (params: Record<string, string> | undefined) => ({
			chemin: params?.['chemin'],
			titre: 'Module stocks',
			type: 'sujet',
			proprietes: [],
			corps: '# Module stocks\n\nGestion des lots et des dates de péremption.\n\n## Faits\n',
			brut: '',
			empreinte: 'x',
			liens: { sortants: [], entrants: [] },
			sessions: [],
			sessionsTotal: 0,
			avertissements: [],
		}),
		'/api/recherche': { trouves: [], avis: {} },
	};
}

beforeEach(() => {
	// Les jetons de jetons.css, comme le navigateur les donnerait à getComputedStyle.
	for (const [nom, valeur] of jetonsDeLaFeuille()) document.documentElement.style.setProperty(nom, valeur);
	// Node 25 et plus posent son propre `localStorage` (indéfini sans fichier) : un stockage en mémoire à la place.
	const valeurs = new Map<string, string>();
	vi.stubGlobal('localStorage', { getItem: (k: string) => valeurs.get(k) ?? null, setItem: (k: string, v: string) => void valeurs.set(k, v), removeItem: (k: string) => void valeurs.delete(k), clear: () => valeurs.clear() });
	simulee.active = false;
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

// Le graphe se charge à part (React.lazy) : sur une machine chargée, plus que la seconde par défaut.
const ATTENTE = { timeout: 5000 };

async function ouvrirLeGraphe(): Promise<void> {
	fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Mémoire/ }));
	fireEvent.click(screen.getByRole('tab', { name: 'Graph 3D' }));
}

describe('Mémoire › Graph 3D', () => {
	it('sans WebGL : message lisible, l’onglet Fichiers et le reste de l’interface restent utilisables', async () => {
		// three.js signale l'échec de WebGL sur la console : attendu, tu ici.
		const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {});
		const faux = creerFauxClient(reponses());
		render(<Application client={faux.client} />);
		await ouvrirLeGraphe();
		expect(await screen.findByText('La vue 3D demande WebGL, indisponible dans ce navigateur.', {}, ATTENTE)).toBeTruthy();
		expect(erreurs).toHaveBeenCalled();

		fireEvent.click(screen.getByRole('tab', { name: 'Fichiers' }));
		expect(screen.getByRole('tab', { name: 'Fichiers' }).getAttribute('aria-selected')).toBe('true');
		expect(screen.getByRole('tabpanel', { name: 'Fichiers' })).toBeTruthy();
		fireEvent.click(within(screen.getByRole('navigation', { name: 'Vues' })).getByRole('button', { name: /Sessions/ }));
		expect(screen.getByRole('main').getAttribute('data-vue')).toBe('sessions');
	});

	describe('scène simulée', () => {
		let scene: ReturnType<typeof sceneSimulee>;
		beforeEach(() => {
			scene = sceneSimulee();
			simulee.active = true;
			simulee.scene = scene;
		});
		const rappels = () => simulee.rappels as RappelsScene;
		const chargements = () => scene.charger.mock.calls.map((appel) => appel[0] as GraphePrepare);

		it('le message `memoire` relit le graphe et rappelle `charger`, positions et épingles gardées', async () => {
			const faux = creerFauxClient(reponses());
			render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(scene.charger).toHaveBeenCalledTimes(1), ATTENTE);
			expect(scene.disposer).toHaveBeenCalled();
			const premier = chargements()[0]!.noeuds.find((n) => n.chemin === 'projets/Module stocks.md')!;
			Object.assign(premier, { x: 123, y: -45, z: 6, epingle: true });

			await act(async () => faux.connexion.emettre({ type: 'memoire', modifieeMs: 2 }));
			await waitFor(() => expect(scene.charger).toHaveBeenCalledTimes(2), ATTENTE);
			const second = chargements()[1]!.noeuds.find((n) => n.chemin === 'projets/Module stocks.md')!;
			expect(second).not.toBe(premier);
			expect([second.x, second.y, second.z, second.epingle]).toEqual([123, -45, 6, true]);
		});

		it('la couleur principale change : les jetons sont relus et la scène recolorée, sans être recréée', async () => {
			const faux = creerFauxClient(reponses());
			render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(scene.charger).toHaveBeenCalledTimes(1), ATTENTE);
			expect(scene.majCouleurs).not.toHaveBeenCalled();

			const racine = document.documentElement;
			racine.style.setProperty('--graphe-eclaire', '#ff8800'); // ce que `var(--ac)` donne une fois `--ac` posé
			act(() => appliquerAccent(racine, '#ff8800'));
			expect(scene.majCouleurs).toHaveBeenCalledTimes(1);
			expect(scene.majCouleurs).toHaveBeenCalledWith(expect.objectContaining({ eclaire: '#ff8800' }));
			expect(scene.charger).toHaveBeenCalledTimes(1);
			expect(scene.detruire).not.toHaveBeenCalled();
		});

		it('touche L → cran de densité suivant, gardé dans localStorage', async () => {
			const faux = creerFauxClient(reponses());
			render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(scene.densiteEtiquettes).toHaveBeenCalledWith({ maximum: 26, chevauchements: false }), ATTENTE);

			fireEvent.keyDown(document.body, { code: 'KeyL', key: 'l' });
			expect(scene.densiteEtiquettes).toHaveBeenLastCalledWith({ maximum: 70, chevauchements: false });
			expect(window.localStorage.getItem('mnemo.graphe.densite')).toBe('3');
			fireEvent.keyDown(document.body, { code: 'KeyL', key: 'l' });
			expect(scene.densiteEtiquettes).toHaveBeenLastCalledWith({ maximum: Infinity, chevauchements: true });
		});

		it('clic sur un nœud → carte ; « Ouvrir la fiche » → onglet Fichiers sur cette fiche', async () => {
			const faux = creerFauxClient(reponses());
			render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(scene.charger).toHaveBeenCalled(), ATTENTE);
			const stocks = chargements()[0]!.noeuds.find((n) => n.chemin === 'projets/Module stocks.md')!;

			await act(async () => rappels().clic(stocks));
			const carte = screen.getByRole('complementary', { name: 'Fiche choisie' });
			expect(within(carte).getByRole('heading', { name: 'Module stocks' })).toBeTruthy();
			expect(await within(carte).findByText('Gestion des lots et des dates de péremption.')).toBeTruthy();
			expect(within(carte).getByText('Relié à (1)')).toBeTruthy();

			fireEvent.click(within(carte).getByRole('button', { name: 'Ouvrir la fiche' }));
			expect(screen.getByRole('tab', { name: 'Fichiers' }).getAttribute('aria-selected')).toBe('true');
			expect(screen.getByText('projets / Module stocks.md')).toBeTruthy();
		});

		it('rotation lente coupée au départ ; allumée puis caché → coupée ; revenu → reprise', async () => {
			const faux = creerFauxClient(reponses());
			render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(scene.rotation).toHaveBeenCalled(), ATTENTE);
			expect(scene.rotation).not.toHaveBeenCalledWith(true);
			const bascule = await screen.findByRole('switch', { name: 'Rotation lente', hidden: true }, ATTENTE);
			expect(bascule.getAttribute('aria-checked')).toBe('false');
			fireEvent.click(bascule);
			expect(scene.rotation).toHaveBeenLastCalledWith(true);
			fireEvent.click(screen.getByRole('tab', { name: 'Fichiers' }));
			expect(scene.rotation).toHaveBeenLastCalledWith(false);
			fireEvent.click(screen.getByRole('tab', { name: 'Graph 3D' }));
			expect(scene.rotation).toHaveBeenLastCalledWith(true);
			expect(scene.detruire).not.toHaveBeenCalled();
		});

		it('blocs repliables : tous repliés au départ, leur état gardé par visiteur', async () => {
			const faux = creerFauxClient(reponses());
			const { unmount } = render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(scene.charger).toHaveBeenCalled(), ATTENTE);
			const bloc = (nom: string) => screen.getByText(nom, { selector: 'summary' }).closest('details')!;
			expect(bloc('Lecture du graphe').open).toBe(false);
			const affichage = bloc('Affichage');
			affichage.open = true;
			fireEvent(affichage, new Event('toggle'));
			expect(JSON.parse(window.localStorage.getItem('mnemo.graphe.blocs')!)).toEqual({ affichage: true });

			unmount();
			render(<Application client={creerFauxClient(reponses()).client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(bloc('Affichage').open).toBe(true), ATTENTE);
			expect(bloc('Arbre').open).toBe(false);
		});

		it('survol : la scène n’est réappliquée que sans sélection', async () => {
			const faux = creerFauxClient(reponses());
			render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(scene.charger).toHaveBeenCalled(), ATTENTE);
			const noeuds = chargements()[0]!.noeuds;
			const stocks = noeuds.find((n) => n.chemin === 'projets/Module stocks.md')!;
			const marc = noeuds.find((n) => n.chemin === 'personnes/Marc Lefèvre.md')!;

			await act(async () => rappels().survol(marc));
			expect(scene.appliquer).toHaveBeenLastCalledWith(expect.objectContaining({ survol: marc }));
			await act(async () => rappels().clic(stocks));
			const avant = scene.appliquer.mock.calls.length;
			await act(async () => rappels().survol(null));
			await act(async () => rappels().survol(marc));
			expect(scene.appliquer.mock.calls.length).toBe(avant);
		});

		it('la branche choisie compte comme un filtre de la recherche', async () => {
			const faux = creerFauxClient(reponses());
			render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(scene.charger).toHaveBeenCalled(), ATTENTE);
			fireEvent.change(screen.getByRole('combobox', { name: 'Branche' }), { target: { value: 'projets' } });
			const { focus } = scene.appliquer.mock.calls.at(-1)![0] as { focus: Set<Noeud> | null };
			expect([...(focus ?? [])].map((n) => n.chemin)).toEqual(['projets/Module stocks.md']);
			expect(screen.getByRole('button', { name: 'Filtres (1)' })).toBeTruthy();
		});

		it('deux types de lien, cochés par défaut dans la légende : « Relié à », le voisinage et les traits suivent les types cochés', async () => {
			const lieu = (chemin: string, parent: string | null): FicheGraphe => ({ ...fiche(chemin, chemin.slice(0, chemin.lastIndexOf('/'))), parent });
			const graphe: DonneesGraphe = {
				...GRAPHE,
				fiches: [lieu('clients/clients.md', null), lieu('clients/acme/acme.md', 'clients/clients.md'), lieu('clients/acme/Contrat.md', 'clients/acme/acme.md'), lieu('clients/acme/Devis.md', 'clients/acme/acme.md')],
				liens: [],
			};
			const faux = creerFauxClient(reponses(graphe));
			render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(scene.charger).toHaveBeenCalled(), ATTENTE);
			const noeuds = chargements()[0]!.noeuds;
			const parChemin = (c: string) => noeuds.find((n) => n.chemin === c)!;
			const legende = screen.getByRole('group', { name: 'Légende et filtre' });
			const parente = within(legende).getByRole<HTMLInputElement>('checkbox', { name: 'Parenté' });
			const personnalise = within(legende).getByRole<HTMLInputElement>('checkbox', { name: 'Lien personnalisé' });
			expect([parente.checked, personnalise.checked]).toEqual([true, true]);
			const dernier = () => scene.appliquer.mock.calls.at(-1)![0] as { focus: Set<Noeud> | null; liensVisibles: unknown[]; parentesVisibles: unknown[] };

			await act(async () => rappels().clic(parChemin('clients/acme/acme.md')));
			const carte = screen.getByRole('complementary', { name: 'Fiche choisie' });
			expect(within(carte).getByText('Relié à (3)')).toBeTruthy();
			expect(dernier().parentesVisibles).toHaveLength(3);

			fireEvent.click(parente);
			expect(within(carte).getByText('Relié à (0)')).toBeTruthy();
			expect(dernier().parentesVisibles).toEqual([]);
			expect([...dernier().focus!].map((n) => n.chemin)).toEqual(['clients/acme/acme.md']);

			fireEvent.click(parente);
			fireEvent.click(personnalise);
			expect(within(carte).getByText('Relié à (3)')).toBeTruthy();
			expect(dernier().liensVisibles).toEqual([]);

			await act(async () => rappels().clic(parChemin('clients/acme/Contrat.md')));
			fireEvent.change(within(carte).getByRole('combobox', { name: 'Voisinage' }), { target: { value: '2' } });
			expect(dernier().focus!.has(parChemin('clients/clients.md'))).toBe(true);
		});

		it('listes coupées du graphe : « Relié à » au-delà de 80 et la recherche au-delà de 60 se déplient par DePlus (« N de plus », « Tout voir »)', async () => {
			const autres = Array.from({ length: 85 }, (_, i) => fiche(`projets/Lot ${i}.md`, 'projets'));
			const graphe: DonneesGraphe = {
				...GRAPHE,
				fiches: [fiche('projets/Centre.md', 'projets'), ...autres],
				liens: autres.map((f) => ({ source: f.chemin, cible: 'projets/Centre.md', cibleEcrite: 'Centre', relation: 'concerne' })),
			};
			const faux = creerFauxClient(reponses(graphe));
			render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(scene.charger).toHaveBeenCalled(), ATTENTE);
			await act(async () => rappels().clic(chargements()[0]!.noeuds.find((n) => n.chemin === 'projets/Centre.md')!));
			const carte = screen.getByRole('complementary', { name: 'Fiche choisie' });
			const liens = () => within(carte).getAllByRole('button').filter((b) => b.textContent?.startsWith('Lot ')).length;
			expect(liens()).toBe(80);
			expect(within(carte).getByText('5 de plus')).toBeTruthy();
			fireEvent.click(within(carte).getByRole('button', { name: 'Tout voir' }));
			expect(liens()).toBe(85);
			expect(within(carte).queryByText(/de plus/)).toBeNull();

			const champ = screen.getByRole('searchbox', { name: 'Chercher dans la mémoire' });
			fireEvent.focus(champ);
			fireEvent.change(champ, { target: { value: 'L' } });
			const recherche = screen.getByRole('search');
			expect(await within(recherche).findByText('25 de plus')).toBeTruthy();
			fireEvent.click(within(recherche).getByRole('button', { name: 'Tout voir' }));
			expect(within(recherche).queryByText(/de plus/)).toBeNull();
		});

		it('« Relié à » vers une fiche d’une autre branche : la branche choisie reste', async () => {
			const faux = creerFauxClient(reponses());
			render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			await waitFor(() => expect(scene.charger).toHaveBeenCalled(), ATTENTE);
			const branche = screen.getByRole('combobox', { name: 'Branche' }) as HTMLSelectElement;
			fireEvent.change(branche, { target: { value: 'personnes' } });
			const marc = chargements()[0]!.noeuds.find((n) => n.chemin === 'personnes/Marc Lefèvre.md')!;
			await act(async () => rappels().clic(marc));
			const carte = screen.getByRole('complementary', { name: 'Fiche choisie' });
			fireEvent.click(within(carte).getByRole('button', { name: /Module stocks/ }));
			expect(branche.value).toBe('personnes');
		});

		it('grande mémoire : branche de départ, « Tout le coffre » désactivé, avis', async () => {
			const fiches = [
				...Array.from({ length: 2000 }, (_, i) => fiche(`personnes/P${i}.md`, 'personnes')),
				...Array.from({ length: 3000 }, (_, i) => fiche(`projets/F${i}.md`, 'projets')),
			];
			const faux = creerFauxClient(reponses({ ...GRAPHE, fiches, liens: [] }));
			render(<Application client={faux.client} />);
			await ouvrirLeGraphe();
			expect(await screen.findByText(/^Mémoire de 5\s000 fiches : le graphe montre une branche à la fois \(2 500 fiches au plus\)\.$/, {}, ATTENTE)).toBeTruthy();
			const branche = screen.getByRole('combobox', { name: 'Branche' }) as HTMLSelectElement;
			expect(branche.value).toBe('personnes');
			expect((within(branche).getByRole('option', { name: 'Tout le coffre' }) as HTMLOptionElement).disabled).toBe(true);
			// la simulation de la branche arrive après l'avis : l'attendre (une machine lente voit d'abord une simulation plus petite)
			await waitFor(() => expect(disposition.creerSimulation.mock.calls.at(-1)![0] as Noeud[]).toHaveLength(2000), ATTENTE);
			const simules = disposition.creerSimulation.mock.calls.at(-1)![0] as Noeud[];
			expect(simules.every((n) => n.branche === 'personnes')).toBe(true);
		});
	});
});
