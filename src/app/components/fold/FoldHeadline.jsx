import {Fragment} from 'react';
import styles from './fold-section.module.css';

export default function FoldHeadline({segments}) {
  return segments.map((segment, index) => <Fragment key={index}>
    {segment.breakBefore && <br />}
    <span className={segment.style === 'accent' ? styles.headlineAccent : segment.style === 'muted' ? styles.headlineMuted : undefined}>{segment.text}</span>
  </Fragment>);
}
