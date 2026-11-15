import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState, ErrorState, LoadingState } from './states';

describe('feedback states', () => {
  it('renders loading state accessibly', () => {
    render(<LoadingState title="Carregando produtos" />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando produtos');
  });

  it('renders empty and error states', () => {
    render(<><EmptyState title="Nenhum produto" /><ErrorState title="Falha ao carregar" /></>);
    expect(screen.getByText('Nenhum produto')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar');
  });
});
