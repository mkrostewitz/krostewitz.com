"use client";

import PhotoEditor from '../components/forms/PhotoEditor';
import LeadAvatar from './LeadAvatar';

export default function LeadPhotoEditor({name, photoUrl, ...props}) {
  return <PhotoEditor {...props} photoUrl={photoUrl}
    preview={<LeadAvatar name={name} photoUrl={photoUrl} size={144} />} />;
}
