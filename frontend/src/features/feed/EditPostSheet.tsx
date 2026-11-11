import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useUiFeedback } from '../../components/feedback/UiFeedback'
import { Button } from '../../components/ui/Button'
import { Sheet } from '../../components/ui/Sheet'
import { apiErrorMessage, validationErrors } from '../../lib/api'
import { updatePost, type Post } from '../../lib/feed'
import { prepareProgressPhoto } from '../../lib/preparePhoto'
import { PostComposer, composerDirty, composerFrom } from './PostComposer'

/** Editar foto, pie de foto y gimnasio de una publicación propia. */
export function EditPostSheet({ post, onClose }: { post: Post; onClose: () => void }) {
  const { notify } = useUiFeedback()
  const [original] = useState(() => composerFrom(post))
  const [value, setValue] = useState(original)

  const save = useMutation({
    mutationFn: async () =>
      updatePost(post.id, {
        caption: value.caption.trim(),
        gym_name: value.gym.trim(),
        photo: value.photo ? await prepareProgressPhoto(value.photo) : null,
        remove_photo: value.removePhoto && !value.photo,
      }),
    onSuccess: () => {
      notify('Publicación actualizada', 'success')
      onClose()
    },
    onError: (error) => notify(Object.values(validationErrors(error))[0] ?? apiErrorMessage(error, 'No se ha podido guardar.'), 'error'),
  })

  return (
    <Sheet
      title="Editar publicación"
      onClose={onClose}
      footer={
        <Button size="lg" fullWidth disabled={!composerDirty(value, original) || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      }
    >
      <PostComposer value={value} onChange={setValue} />
    </Sheet>
  )
}
