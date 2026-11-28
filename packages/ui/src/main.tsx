import { estChoixLangue } from '@mnemo/commun';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Client } from './client/contexte.tsx';
import { creerClientReel } from './client/creer-client.ts';
import { lireSessionDuFragment } from './client/fragment.ts';
import { effacerJetonDeLAdresse, lireJeton } from './client/jeton.ts';
import { Application, type Depart } from './composants/Application.tsx';
import './styles/jetons.css';
import './styles/base.css';
import './styles/coquille.css';
import { poserCoquille } from './coquille.ts';

// App de bureau : le marqueur est posé avant le premier rendu (pas de saut de la carte à la fenêtre pleine).
poserCoquille(document.documentElement, navigator.userAgent);

/** `localStorage` de cette origine (port compris), ou null s'il est bloqué. */
function stockageDeLOrigine(): Storage | null {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

async function creerClient(): Promise<{ client: Client | null; depart?: Depart; session?: string | null }> {
	// Mode démo : en développement seulement ; la construction de production retire cette branche et son import.
	const parametres = new URLSearchParams(location.search);
	if (import.meta.env.DEV && parametres.has('demo')) {
		const { creerClientDemo } = await import('./client/demo.ts');
		const fiche = parametres.get('fiche');
		const conflit = parametres.get('conflit') === '1' ? { changementExterne: fiche ?? FICHE_DEMO } : {};
		const { depart } = departDemo(parametres.get('vue'), Number(parametres.get('zoom')) || 0, fiche, parametres.get('edition') === '1');
		const archiviste = parametres.get('archiviste') === '1';
		const palette = parametres.get('palette');
		const enPlus = { ...(archiviste ? { archiviste } : {}), ...(palette !== null ? { palette } : {}) };
		const avecEnPlus = depart ? { ...depart, ...enPlus } : Object.keys(enPlus).length ? { vue: 'sessions' as const, ...enPlus } : undefined;
		const modeles = parametres.get('modeles');
		const entrainement = parametres.get('entrainement');
		const departEntrainement = entrainement === 'vide' || entrainement === 'sansjuge' || entrainement === 'volume' || entrainement === 'accepte' ? { entrainement: entrainement as 'vide' | 'sansjuge' | 'volume' | 'accepte' } : {};
		// classement vivant : `&coupure=1` (injection automatique coupée par le suivi), `&suggestion=1` (règle des 3 sessions)
		const classement = { ...(parametres.get('coupure') === '1' ? { coupure: true } : {}), ...(parametres.get('suggestion') === '1' ? { suggestion: true } : {}) };
		const volume = parametres.get('volume') === '1' ? { volume: true } : {};
		const langue = parametres.get('langue');
		const departLangue = estChoixLangue(langue) ? { langue } : {};
		return { client: creerClientDemo({ ...conflit, ...classement, ...departEntrainement, ...departLangue, ...volume, ...(modeles !== null ? { modeles } : {}) }), ...(avecEnPlus ? { depart: avecEnPlus } : {}) };
	}
	// le jeton de la première ouverture : rangé dans le stockage de cette origine ; la session demandée (`#session=<id>`,
	// seule ou avec le jeton) : ouverte une fois la liste reçue ; le fragment est retiré de l'adresse tout de suite
	const stockage = stockageDeLOrigine();
	const jeton = lireJeton(location.hash, stockage);
	const session = lireSessionDuFragment(location.hash);
	if (location.hash) effacerJetonDeLAdresse(history, location.href);
	if (!jeton) return { client: null };
	return { client: creerClientReel({ jeton, origine: location.origin, fetch: (entree, init) => fetch(entree, init), WebSocket, stockage }), session };
}

const FICHE_DEMO = 'projets/erp-saas/Module stocks.md';

/**
 * Mode démo : `&vue=graphe` (ou `fichiers`, `archiviste`, `entrainer`, `sessions`, `memoire`, `reglages`) ouvre directement une vue ou un onglet, `&zoom=n` la n-ième session en
 * grand ; `&fiche=<chemin>` ouvre une fiche dans Mémoire › Fichiers, `&edition=1` en édition, `&conflit=1` fait écrire la
 * fiche par une « autre fenêtre » 2,5 s après le départ (avis de conflit, 409 à l'enregistrement) ; `&archiviste=1` ouvre
 * le tiroir de l'archiviste, `&palette=<texte>` la palette avec ce texte ; `&modeles=<état>` l'état des modèles locaux
 * (`veille`, `chargement`, `prets`, `vectorisation`, `recherche`, `sens`, `coupes`, `echec`, ou `anime`) ; `&entrainement=`
 * le départ de Mémoire › Entraîner (`vide`, `sansjuge`, `volume`, `accepte`) ; `&langue=en` (ou `fr`) la langue de l'interface ; `&volume=1` quelques centaines de fiches en plus ; pour les captures.
 */
function departDemo(vue: string | null, zoom: number, fiche: string | null, edition: boolean): { depart?: Depart } {
	const enGrand = zoom > 0 ? { zoom } : {};
	if (fiche !== null) return { depart: { vue: 'memoire', ongletMemoire: 'fichiers', fiche, edition, ...enGrand } };
	if (vue === 'graphe' || vue === 'fichiers' || vue === 'archiviste' || vue === 'entrainer') return { depart: { vue: 'memoire', ongletMemoire: vue, ...enGrand } };
	if (vue === 'sessions' || vue === 'memoire' || vue === 'reglages') return { depart: { vue, ...enGrand } };
	return zoom > 0 ? { depart: { vue: 'sessions', zoom } } : {};
}

// Application installable (PWA) : un service worker qui ne garde rien (public/sw.js) ; jamais en développement.
if (!import.meta.env.DEV && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});

const element = document.getElementById('racine');
if (!element) throw new Error('Élément #racine absent de index.html');
const racine = createRoot(element);
void creerClient().then(({ client, depart, session }) =>
	racine.render(
		<StrictMode>
			<Application client={client} {...(depart ? { depart } : {})} session={session ?? null} />
		</StrictMode>,
	),
);
