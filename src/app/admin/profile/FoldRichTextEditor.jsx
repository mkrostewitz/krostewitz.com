"use client";

import {useEffect} from 'react';
import {EditorContent, Extension, Mark, useEditor, useEditorState} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {Bold, Italic, Underline, Strikethrough, Highlighter, CornerDownLeft, Eraser, Undo2, Redo2} from 'lucide-react';
import {foldEditorHtml, foldInlineHtml} from '../../lib/foldContent.mjs';
import styles from '../admin.module.css';
import editorStyles from './fold-rich-text.module.css';

const Accent = Mark.create({
  name: 'foldAccent',
  parseHTML: () => [{tag: 'span'}],
  renderHTML: () => ['span', 0],
});
const LineBreaks = Extension.create({
  name: 'foldLineBreaks',
  addKeyboardShortcuts() {
    return {Enter: () => this.editor.commands.setHardBreak()};
  },
});

export default function FoldRichTextEditor({label, value, language, disabled, onChange, highlight = false}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({
      heading: false, blockquote: false, bulletList: false, orderedList: false,
      listItem: false, listKeymap: false, code: false, codeBlock: false,
      horizontalRule: false, link: false, trailingNode: false,
    }), Accent, LineBreaks],
    content: foldEditorHtml(value),
    immediatelyRender: false,
    editorProps: {attributes: {role: 'textbox', 'aria-label': label, 'aria-multiline': 'true', 'aria-required': 'true', lang: language}},
    onUpdate: ({editor}) => onChange(editor.isEmpty ? '' : foldInlineHtml(editor.getHTML())),
  });
  useEffect(() => {editor?.setEditable(!disabled);}, [editor, disabled]);
  useEffect(() => {
    if (editor && foldInlineHtml(editor.getHTML()) !== foldInlineHtml(value)) {
      editor.commands.setContent(foldEditorHtml(value), {emitUpdate: false});
    }
  }, [editor, value]);
  const state = useEditorState({editor, selector: ({editor}) => editor ? {
    bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'),
    strike: editor.isActive('strike'), foldAccent: editor.isActive('foldAccent'),
    undo: editor.can().undo(), redo: editor.can().redo(),
  } : {}});
  const actions = [
    ['Bold', Bold, 'bold', () => editor.chain().focus().toggleBold().run()],
    ['Italic', Italic, 'italic', () => editor.chain().focus().toggleItalic().run()],
    ['Underline', Underline, 'underline', () => editor.chain().focus().toggleUnderline().run()],
    ['Strikethrough', Strikethrough, 'strike', () => editor.chain().focus().toggleStrike().run()],
    ...(highlight ? [['Headline highlight', Highlighter, 'foldAccent', () => editor.chain().focus().toggleMark('foldAccent').run()]] : []),
    ['Line break', CornerDownLeft, null, () => editor.chain().focus().setHardBreak().run()],
    ['Clear formatting', Eraser, null, () => editor.chain().focus().unsetAllMarks().run()],
    ['Undo', Undo2, 'undo', () => editor.chain().focus().undo().run()],
    ['Redo', Redo2, 'redo', () => editor.chain().focus().redo().run()],
  ];
  return <div className={editorStyles.field}>
    <div className={editorStyles.label}>{label}</div>
    <div className={styles.richTextEditorBox} aria-disabled={disabled}>
      <div className={styles.richTextToolbarBox}>
        <div className={styles.richTextToolbar} role="group" aria-label={`${label} formatting`}>
          {actions.map(([name, Icon, key, action]) => <button key={name} type="button"
            className={styles.richTextButton} title={name} aria-label={name}
            aria-pressed={key && !['undo', 'redo'].includes(key) ? Boolean(state?.[key]) : undefined}
            disabled={disabled || !editor || (['undo', 'redo'].includes(key) && !state?.[key])}
            onMouseDown={event => event.preventDefault()} onClick={action}><Icon size={18} /></button>)}
        </div>
      </div>
      <EditorContent editor={editor} className={editorStyles.editor} />
    </div>
    {highlight && <small className={styles.muted}>Select words and choose Headline highlight to apply the accent color.</small>}
  </div>;
}
