"use client";

import {useEffect} from 'react';
import {EditorContent, useEditor, useEditorState} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {Box, Button, Stack, Typography} from '@mui/material';
import styles from './timeline-editor.module.css';

export default function TimelineRichTextEditor({label, value, disabled, onChange}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({heading: {levels: [3, 4]}, link: {openOnClick: false}, codeBlock: false, code: false, horizontalRule: false})],
    content: value,
    immediatelyRender: false,
    editorProps: {attributes: {role: 'textbox', 'aria-label': label, 'aria-multiline': 'true'}},
    onUpdate: ({editor}) => onChange(editor.getHTML()),
  });
  useEffect(() => {editor?.setEditable(!disabled);}, [editor, disabled]);
  useEffect(() => {
    if (editor && editor.getHTML() !== value) editor.commands.setContent(value, {emitUpdate: false});
  }, [editor, value]);
  const state = useEditorState({editor, selector: ({editor}) => editor ? {
    bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'),
    heading: editor.isActive('heading', {level: 3}), bullet: editor.isActive('bulletList'), ordered: editor.isActive('orderedList'), quote: editor.isActive('blockquote'),
  } : {}});
  const actions = [
    ['Bold', 'bold', () => editor.chain().focus().toggleBold().run()],
    ['Italic', 'italic', () => editor.chain().focus().toggleItalic().run()],
    ['Underline', 'underline', () => editor.chain().focus().toggleUnderline().run()],
    ['Heading', 'heading', () => editor.chain().focus().toggleHeading({level: 3}).run()],
    ['Bullets', 'bullet', () => editor.chain().focus().toggleBulletList().run()],
    ['Numbered list', 'ordered', () => editor.chain().focus().toggleOrderedList().run()],
    ['Quote', 'quote', () => editor.chain().focus().toggleBlockquote().run()],
  ];
  return <Box>
    <Typography variant="body2" sx={{mb: 1, fontWeight: 600}}>{label}</Typography>
    <Box sx={{border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', opacity: disabled ? .6 : 1}}>
      <Stack direction="row" spacing={.5} useFlexGap sx={{flexWrap: 'wrap', p: 1, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider'}} role="group" aria-label={`${label} formatting`}>
        {actions.map(([name, key, action]) => <Button key={key} type="button" size="small" variant={state?.[key] ? 'contained' : 'text'} aria-pressed={Boolean(state?.[key])} disabled={disabled || !editor} onClick={action}>{name}</Button>)}
        <Button type="button" size="small" disabled={disabled || !editor} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>Clear formatting</Button>
        <Button type="button" size="small" disabled={disabled || !editor} onClick={() => editor.chain().focus().undo().run()}>Undo</Button>
        <Button type="button" size="small" disabled={disabled || !editor} onClick={() => editor.chain().focus().redo().run()}>Redo</Button>
      </Stack>
      <EditorContent editor={editor} className={styles.richEditor} />
    </Box>
  </Box>;
}
