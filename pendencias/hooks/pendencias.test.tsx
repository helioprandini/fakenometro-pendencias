import { expect, test } from 'claude-code/testing'
import { abertas, listar } from './register'

const dados = { quadros: [
  { nome: 'EDITORIAL INSTAGRAM', itens: [{ id: 1, texto: 'A', feita: false }, { id: 2, texto: 'B', feita: true }] },
  { nome: 'VAZIO', itens: [{ id: 3, texto: 'C', feita: true }] },
] }

test('mostra só as abertas e esconde quadro sem nada aberto', async () => {
  expect(abertas(dados)).toEqual([{ nome: 'EDITORIAL INSTAGRAM', itens: [{ id: 1, texto: 'A', feita: false }] }])
})

test('o comando lista por quadro', async () => {
  expect(listar(abertas(dados))).toBe('EDITORIAL INSTAGRAM\n#1 A')
  expect(listar([])).toBe('Nenhuma pendência.')
})
