"use client";

import {Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography} from '@mui/material';
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
    <Typography variant="subtitle1">Headline segments</Typography>
    {copy.headline.map((segment, index) => <Box key={index} sx={{border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2}}>
      <Stack spacing={1}>
        <TextField {...textProps(500)} required multiline label={`Segment ${index + 1}`} value={segment.text}
          onChange={event => changeSegment(index, {text: event.target.value})} />
        <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap: 'wrap', alignItems: 'center'}}>
          <TextField select size="small" label="Style" disabled={disabled} value={segment.style} sx={{minWidth: 140}}
            onChange={event => changeSegment(index, {style: event.target.value})}>
            {FOLD_STYLES.map(style => <MenuItem key={style} value={style}>{style}</MenuItem>)}
          </TextField>
          <FormControlLabel label="Line break before" control={<Checkbox disabled={disabled} checked={segment.breakBefore} onChange={event => changeSegment(index, {breakBefore: event.target.checked})} />} />
          <Button type="button" disabled={disabled || index === 0} aria-label={`Move segment ${index + 1} up`} onClick={() => moveSegment(index, -1)}>Up</Button>
          <Button type="button" disabled={disabled || index === copy.headline.length - 1} aria-label={`Move segment ${index + 1} down`} onClick={() => moveSegment(index, 1)}>Down</Button>
          <Button type="button" disabled={disabled || copy.headline.length === 1} aria-label={`Remove segment ${index + 1}`} onClick={() => onChange({...copy, headline: copy.headline.filter((_, i) => i !== index)})}>Remove</Button>
        </Stack>
      </Stack>
    </Box>)}
    <div><Button type="button" disabled={disabled || copy.headline.length >= 12} onClick={() => onChange({...copy, headline: [...copy.headline, {text: ' New phrase', style: 'primary', breakBefore: false}]})}>Add headline segment</Button></div>
    <Box role="region" aria-label="Headline preview" lang={language} sx={{p: 2, bgcolor: '#111317', color: '#fff', borderRadius: 1, fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 700, lineHeight: 1.15, whiteSpace: 'pre-wrap'}}>
      <FoldHeadline segments={copy.headline} />
    </Box>
    <TextField {...textProps(3000)} required multiline minRows={3} label="Subheadline" value={copy.subheadline} onChange={event => onChange({...copy, subheadline: event.target.value})} />
    <TextField {...textProps(3000)} required multiline minRows={3} label="Personal statement" value={copy.statement} onChange={event => onChange({...copy, statement: event.target.value})} />
    {copy.cards.map((card, index) => <Stack spacing={1} key={index}>
      <Typography variant="subtitle1">Competency card {index + 1}</Typography>
      {['title', 'description'].map(field => <TextField key={field} {...textProps(field === 'title' ? 200 : 2000)}
        required multiline minRows={field === 'description' ? 2 : 1} label={`Card ${index + 1} ${field}`} value={card[field]}
        onChange={event => onChange({...copy, cards: copy.cards.map((item, i) => i === index ? {...item, [field]: event.target.value} : item)})} />)}
    </Stack>)}
    {['booking', 'linkedin'].map(key => <TextField key={key} {...textProps(100)} required label={`${key === 'booking' ? 'Booking' : 'LinkedIn'} button label`} value={copy.ctaLabels[key]} onChange={event => onChange({...copy, ctaLabels: {...copy.ctaLabels, [key]: event.target.value}})} />)}
  </Stack>;
}
