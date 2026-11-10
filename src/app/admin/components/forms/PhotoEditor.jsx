"use client";

import {useEffect, useRef, useState} from 'react';
import {Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Slider, Typography} from '@mui/material';
import {Pencil} from 'lucide-react';

import {rectangularPhotoCrop} from '../../../lib/photoCrop.mjs';

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function PhotoEditor({photoUrl, onChange, disabled, preview, label = "contact photo", purpose = "lead-photo", aspectRatio = 1, circular = true, saveHint = "Save the lead to keep your changes."}) {
  const outputWidth = 512;
  const outputHeight = Math.round(outputWidth / aspectRatio);
  const picker = useRef(null);
  const canvas = useRef(null);
  const image = useRef(null);
  const source = useRef(null);
  const drag = useRef(null);
  const request = useRef(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const [crop, setCrop] = useState({zoom: 1, x: .5, y: .5});
  const [dimensions, setDimensions] = useState(null);
  useEffect(() => () => {
    request.current?.abort();
    if (source.current) URL.revokeObjectURL(source.current);
  }, []);

  async function load(file) {
    if (disabled || busy) return;
    setError('');
    if (!file || !TYPES.includes(file.type)) {setError('Choose a JPG, PNG, or WebP image.'); return;}
    if (file.size > MAX_BYTES) {setError('Choose an image smaller than 10 MB.'); return;}
    setOpen(true); setBusy(true); setDimensions(null);
    if (source.current) URL.revokeObjectURL(source.current);
    const url = URL.createObjectURL(file);
    source.current = url;
    try {
      const next = new Image();
      next.src = url;
      await next.decode();
      if (source.current !== url) return;
      if (!next.naturalWidth || !next.naturalHeight || next.naturalWidth * next.naturalHeight > 40000000) throw new Error('Choose an image with at most 40 megapixels.');
      image.current = next;
      setCrop({zoom: 1, x: .5, y: .5});
      setDimensions({width: next.naturalWidth, height: next.naturalHeight});
    } catch (failure) {setError(failure.message?.includes('megapixels') ? failure.message : 'This image could not be opened. Try another file.');}
    finally {setBusy(false);}
  }

  useEffect(() => {
    if (!open || !dimensions || !canvas.current || !image.current) return;
    const {sx, sy, width, height} = rectangularPhotoCrop(dimensions.width, dimensions.height, crop.zoom, crop.x, crop.y, aspectRatio);
    const context = canvas.current.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(image.current, sx, sy, width, height, 0, 0, outputWidth, outputHeight);
  }, [crop, dimensions, open, aspectRatio, outputHeight]);

  async function editExisting() {
    if (busy || disabled) return;
    setBusy(true); setError('');
    const controller = new AbortController();
    request.current = controller;
    let file;
    try {
      const response = /^\/(?!\/)/.test(photoUrl) ? await fetch(photoUrl, {signal: controller.signal}) : await fetch('/api/admin/leads/photo', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url: photoUrl}), signal: controller.signal});
      if (!response.ok) {const data = await response.json(); throw new Error(data.error || 'Unable to load photo.');}
      file = await response.blob();
    } catch (failure) {if (failure.name !== 'AbortError') setError(failure.message);}
    finally {setBusy(false); request.current = null;}
    // load is called after the fetch, using this render's idle state.
    if (file && !controller.signal.aborted) await load(file);
  }

  function close() {
    if (busy) return;
    setOpen(false); setDimensions(null); setError(''); image.current = null;
    if (source.current) URL.revokeObjectURL(source.current);
    source.current = null;
  }
  async function apply() {
    if (!dimensions || busy) return;
    setBusy(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try {
      const blob = await new Promise(resolve => canvas.current.toBlob(resolve, 'image/jpeg', .9));
      if (!blob) throw new Error('Unable to crop this photo.');
      const body = new FormData(); body.set('purpose', purpose); body.set('file', blob, 'photo.jpg');
      const response = await fetch('/api/admin/uploads', {method: 'POST', body, signal: controller.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to upload photo.');
      await onChange(data.asset.url);
      setOpen(false); setDimensions(null); image.current = null;
      if (source.current) URL.revokeObjectURL(source.current);
      source.current = null;
    } catch (failure) {if (failure.name !== 'AbortError') setError(failure.message);}
    finally {setBusy(false); request.current = null;}
  }
  function move(event) {
    if (!drag.current || !dimensions || busy) return;
    const {width, height} = rectangularPhotoCrop(dimensions.width, dimensions.height, crop.zoom, crop.x, crop.y, aspectRatio);
    const scale = width / event.currentTarget.getBoundingClientRect().width;
    const dx = (event.clientX - drag.current.x) * scale;
    const dy = (event.clientY - drag.current.y) * scale;
    setCrop(current => ({...current,
      x: Math.max(0, Math.min(1, drag.current.crop.x - dx / (dimensions.width - width || 1))),
      y: Math.max(0, Math.min(1, drag.current.crop.y - dy / (dimensions.height - height || 1)))}));
  }

  return <>
    <Button type="button" disabled={disabled || busy} onClick={() => {setError(''); setOpen(true); if (photoUrl) void editExisting();}}
      onDragOver={event => {event.preventDefault(); if (!disabled && !busy) setOver(true);}}
      onDragLeave={() => setOver(false)} onDrop={event => {event.preventDefault(); setOver(false); if (!disabled && !busy) void load(event.dataTransfer.files[0]);}}
      aria-label={`${photoUrl ? "Edit" : "Add"} ${label}`}
      sx={{p: 0, minWidth: 0, width: 'fit-content', maxWidth: '100%', justifySelf: 'start', borderRadius: circular ? '50%' : 2, position: 'relative', outline: over ? '3px solid' : undefined, outlineColor: 'primary.main'}}>
      {preview}
      <Box component="span" sx={{position: 'absolute', bottom: 4, right: 4, display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', border: '2px solid', borderColor: 'background.paper'}}><Pencil size={16} /></Box>
    </Button>
    <input ref={picker} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {void load(event.target.files?.[0]); event.target.value = '';}} />
    <Dialog open={open} onClose={close} fullWidth maxWidth="xs" aria-labelledby="crop-photo-title">
      <DialogTitle id="crop-photo-title">{photoUrl ? "Edit" : "Add"} {label}</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{mb: 2}}>Upload a photo, then drag to position it or use the sliders. {saveHint}</Typography>
        <Box onDragOver={event => {event.preventDefault(); if (!busy) setOver(true);}} onDragLeave={() => setOver(false)}
          onDrop={event => {event.preventDefault(); setOver(false); if (!busy) void load(event.dataTransfer.files[0]);}}
          sx={{border: '1px dashed', borderColor: over ? 'primary.main' : 'divider', borderRadius: 2, p: 2, mb: 2, textAlign: 'center', bgcolor: over ? 'action.selected' : undefined}}>
          <Button type="button" disabled={busy} onClick={() => picker.current.click()}>Choose photo</Button>
          <Typography variant="caption" display="block">or drop a JPG, PNG, or WebP here · up to 10 MB</Typography>
        </Box>
        {error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}
        {!dimensions && <Typography>{busy ? 'Loading photo…' : 'Choose a photo to start cropping.'}</Typography>}
        <Box sx={{display: dimensions ? 'block' : 'none', width: '100%', aspectRatio, borderRadius: circular ? '50%' : 2, overflow: 'hidden', bgcolor: 'action.hover'}}>
          <canvas ref={canvas} width={outputWidth} height={outputHeight} aria-label={`${label} crop preview`} style={{width: '100%', display: 'block', touchAction: 'none', cursor: 'grab'}}
            onPointerDown={event => {if (!busy) {event.currentTarget.setPointerCapture(event.pointerId); drag.current = {x: event.clientX, y: event.clientY, crop};}}}
            onPointerMove={move} onPointerUp={() => {drag.current = null;}} onPointerCancel={() => {drag.current = null;}} />
        </Box>
        {dimensions && <Box sx={{px: 1, pt: 2}}>
          {[['zoom', 'Zoom', 1, 4], ['x', 'Horizontal position', 0, 1], ['y', 'Vertical position', 0, 1]].map(([key, label, min, max]) => <Box key={key}>
            <Typography variant="caption">{label}</Typography>
            <Slider aria-label={label} min={min} max={max} step={.01} value={crop[key]} disabled={busy} onChange={(_, value) => setCrop(current => ({...current, [key]: value}))} />
          </Box>)}
        </Box>}
      </DialogContent>
      <DialogActions sx={{flexWrap: 'wrap'}}>
        {photoUrl && <Button type="button" color="error" disabled={busy} onClick={async () => {setBusy(true); setError(''); try {await onChange(''); close();} catch (failure) {setError(failure.message);} finally {setBusy(false);}}} sx={{mr: 'auto'}}>Remove photo</Button>}
        <Button type="button" disabled={busy} onClick={close}>Cancel</Button>
        <Button type="button" variant="contained" disabled={busy || !dimensions} onClick={apply}>{busy ? 'Working…' : 'Apply crop'}</Button>
      </DialogActions>
    </Dialog>
  </>;
}
