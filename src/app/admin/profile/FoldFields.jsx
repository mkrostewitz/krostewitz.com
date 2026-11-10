"use client";

import {Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, IconButton, Tooltip} from '@mui/material';
import {ArrowUp, ArrowDown, Trash2, Plus} from 'lucide-react';
import layout from './profile-settings.module.css';
import {FOLD_STYLES} from '../../lib/foldContent.mjs';
import FoldHeadline from '../../components/fold/FoldHeadline';

export default function FoldFields({copy, language, onChange, disabled = false}) {
  function changeSegment(index, patch) {
    onChange({...copy, headline: copy.headline.map((segment, i) => i === index ? {...segment, ...patch} : segment)});
  }
  function moveSegment(index, offset) {
    const headline = [...copy.headline];
    [headline[index], headline[index + offset]] = [headline[index + offset], headline[index]];
    onChange({...copy, headline});
  }
  const textProps = (limit) => ({disabled, fullWidth: true, slotProps: {htmlInput: {maxLength: limit, lang: language}}});
  return <Stack spacing={2}>
    <TextField {...textProps(200)} label="Eyebrow / overline" value={copy.eyebrow} onChange={event => onChange({...copy, eyebrow: event.target.value})} />
    <div className={layout.fieldGroup}>
    <div className={layout.groupHeading}><h3>Headline</h3><p>Arrange phrases and choose how each one is highlighted.</p></div>
    {copy.headline.map((segment, index) => <Box key={index} className={layout.card}>
      <Stack spacing={1}>
        <TextField {...textProps(500)} required multiline label={`Segment ${index + 1}`} value={segment.text}
          onChange={event => changeSegment(index, {text: event.target.value})} />
        <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap: 'wrap', alignItems: 'center'}}>
          <TextField select fullWidth={false} size="small" label="Style" disabled={disabled} value={segment.style} sx={{minWidth: 140}}
            onChange={event => changeSegment(index, {style: event.target.value})}>
            {FOLD_STYLES.map(style => <MenuItem key={style} value={style}>{style}</MenuItem>)}
          </TextField>
          <FormControlLabel label="Line break before" control={<Checkbox disabled={disabled} checked={segment.breakBefore} onChange={event => changeSegment(index, {breakBefore: event.target.checked})} />} />
          <Stack direction="row" spacing={.5} sx={{ml: 'auto'}}>
            {[
              ['Move up', ArrowUp, index === 0, () => moveSegment(index, -1)],
              ['Move down', ArrowDown, index === copy.headline.length - 1, () => moveSegment(index, 1)],
              ['Remove', Trash2, copy.headline.length === 1, () => onChange({...copy, headline: copy.headline.filter((_, i) => i !== index)})],
            ].map(([label, Icon, unavailable, action]) => <Tooltip title={label} key={label}><span>
              <IconButton type="button" size="small" disabled={disabled || unavailable} aria-label={`${label} segment ${index + 1}`} onClick={action}><Icon size={17} /></IconButton>
            </span></Tooltip>)}
          </Stack>
        </Stack>
      </Stack>
    </Box>)}
    <div><Button type="button" startIcon={<Plus size={16} />} disabled={disabled || copy.headline.length >= 12} onClick={() => onChange({...copy, headline: [...copy.headline, {text: ' New phrase', style: 'primary', breakBefore: false}]})}>Add headline segment</Button></div>
    <div role="region" aria-label="Headline preview" lang={language} className={layout.preview}>
      <span className={layout.previewLabel}>Live headline preview</span>
      <div className={layout.previewText}><FoldHeadline segments={copy.headline} /></div>
    </div>
    </div>
    <div className={layout.fieldGroup}>
      <div className={layout.groupHeading}><h3>Supporting text</h3><p>Your introduction and the personal statement beneath it.</p></div>
      <div className={layout.twoColumns}>
    <TextField className={layout.alignedField} {...textProps(3000)} required multiline minRows={3} label="Subheadline" value={copy.subheadline} onChange={event => onChange({...copy, subheadline: event.target.value})} />
    <TextField className={layout.alignedField} {...textProps(3000)} required multiline minRows={3} label="Personal statement" value={copy.statement} onChange={event => onChange({...copy, statement: event.target.value})} />
      </div>
    </div>
    <div className={layout.fieldGroup}>
      <div className={layout.groupHeading}><h3>Competency cards</h3><p>The three areas of expertise displayed below your introduction.</p></div>
      <div className={layout.cardGrid}>
    {copy.cards.map((card, index) => <div className={`${layout.card} ${layout.competencyCard}`} key={index}>
      <span className={layout.cardNumber}>Card 0{index + 1}</span>
      {['title', 'description'].map(field => <TextField key={field} className={layout.alignedField} {...textProps(field === 'title' ? 200 : 2000)}
        required multiline minRows={field === 'description' ? 2 : 1} label={`Card ${index + 1} ${field}`} value={card[field]}
        onChange={event => onChange({...copy, cards: copy.cards.map((item, i) => i === index ? {...item, [field]: event.target.value} : item)})} />)}
    </div>)}
      </div>
    </div>
    <div className={layout.fieldGroup}>
      <div className={layout.groupHeading}><h3>Call-to-action buttons</h3><p>Edit the labels shown on your homepage.</p></div>
      <div className={layout.twoColumns}>
    {['booking', 'linkedin'].map(key => <TextField key={key} {...textProps(100)} required label={`${key === 'booking' ? 'Booking' : 'LinkedIn'} button label`} value={copy.ctaLabels[key]} onChange={event => onChange({...copy, ctaLabels: {...copy.ctaLabels, [key]: event.target.value}})} />)}
      </div>
    </div>
  </Stack>;
}
