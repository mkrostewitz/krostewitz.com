"use client";

import {Button, Stack} from '@mui/material';
import FoldRichTextEditor from './FoldRichTextEditor';
import {FOLD_LIMITS} from '../../lib/foldContent.mjs';

const labels = {title: 'Headline', subtitle: 'Introduction', usp: 'Unique selling proposition'};

export default function FoldFields({copy, language, onChange, disabled = false}) {
  return <Stack spacing={2}>
    {Object.keys(FOLD_LIMITS).map(field => <FoldRichTextEditor key={`${language}-${field}`}
      label={labels[field]} value={copy[field]} language={language} disabled={disabled} highlight={field === 'title'}
      onChange={value => onChange({...copy, [field]: value})} />)}
    {copy.points.map((point, index) => <Stack key={`${language}-${index}`} direction="row" spacing={1} alignItems="start">
      <FoldRichTextEditor label={`Offering ${index + 1}`} value={point} language={language} disabled={disabled}
        onChange={value => onChange({...copy, points: copy.points.map((item, i) => i === index ? value : item)})} />
      <Button type="button" disabled={disabled || copy.points.length === 1}
        aria-label={`Remove offering ${index + 1}`}
        onClick={() => onChange({...copy, points: copy.points.filter((_, i) => i !== index)})}>Remove</Button>
    </Stack>)}
    <div><Button type="button" disabled={disabled || copy.points.length >= 12}
      onClick={() => onChange({...copy, points: [...copy.points, '']})}>Add offering</Button></div>
  </Stack>;
}
