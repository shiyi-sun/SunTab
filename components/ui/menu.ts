import type { Component } from 'vue';

export interface MenuEntry {
  id: string;
  label: string;
  icon?: Component;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  divider?: boolean;
  children?: MenuEntry[];
  action?: () => void;
}
