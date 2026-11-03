"use client";

import {Avatar} from '@mui/material';

export default function LeadAvatar({name = '', photoUrl = '', size = 36}) {
  const initials = name.trim().split(/\s+/).filter(Boolean).map(part => part[0]).filter((_, index, all) => index === 0 || index === all.length - 1).join('').toUpperCase() || '?';
  return <Avatar src={photoUrl || undefined} alt={name ? `${name} profile photo` : 'Contact photo'}
    slotProps={{img: {referrerPolicy: 'no-referrer'}}}
    sx={{width: size, height: size, fontSize: size / 2.5}}>{initials}</Avatar>;
}
