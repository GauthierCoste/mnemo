/**
 * Bandeau d'avancement vers les vrais résultats, sous la note de confiance (page Entraîner) : toute la ligne est la barre,
 * remplie d'un fond léger jusqu'à son pourcentage. « Vers les vrais résultats », le pourcentage, l'écart depuis l'apprentissage
 * d'avant, puis les volumes en clair (fait / il en faut) ou, le volume atteint, le critère de qualité qui manque et une coche
 * verte en bout de ligne. Chaque
 * élément au curseur d'aide a son infobulle. Absent quand une note est acceptée (les % sont là).
 */
import type { AvancementNoteVue } from '@mnemo/contrat';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { textesAvancement } from '../../../memoire/entrainement.ts';
import { useTextes } from '../../../langue/langue.tsx';
import s from './Entrainer.module.css';

export function AvancementNote(p: { avancement: AvancementNoteVue }): ReactNode {
	const textes = useTextes().memoire.entrainer;
	const ta = textes.avancement;
	const t = textesAvancement(p.avancement, textes);
	const part = p.avancement.part ?? 0;
	return (
		<p
			className={s.avancement}
			// le fond rempli est décoratif : le texte dit le pourcentage et les volumes (un rôle progressbar masquerait ce texte)
			style={{ '--part': `${Math.round(part * 100)}%` } as CSSProperties}
		>
			<span className={s.aideSurvol} title={t.explication}>
				{ta.titre}
			</span>
			<span className={s.pctAvancement}>{t.pourcentage}</span>
			{t.ecart !== null && (
				<span className={`${s.ecartAvancement} ${s.aideSurvol}`} title={t.ecart.titre}>
					{t.ecart.texte}
				</span>
			)}
			{t.qualite !== null && (
				<>
					<span className={s.sepAvancement}>·</span>
					<span>{t.qualite}</span>
					<CocheVolume titre={ta.volumeAtteint} />
				</>
			)}
			{t.sansApprentissage && (
				<>
					<span className={s.sepAvancement}>·</span>
					<span>{ta.connuAuPremier}</span>
				</>
			)}
			{t.volumes.map((v) => (
				<Fragment key={v.nom}>
					<span className={s.sepAvancement}>·</span>
					<span className={`${s.volume} ${s.aideSurvol}`} title={v.titre}>
						{ta.volume(v.nom, <b>{v.fait}</b>, v.cible)}
					</span>
				</Fragment>
			))}
		</p>
	);
}

/** Coche verte en bout de ligne : le volume est atteint (le vert est fixe, une couleur de sens). */
function CocheVolume(p: { titre: string }): ReactNode {
	return (
		<svg className={s.cocheVolume} viewBox="0 0 16 16" width="14" height="14" role="img" aria-label={p.titre}>
			<title>{p.titre}</title>
			<path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}
