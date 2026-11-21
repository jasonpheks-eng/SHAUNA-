import React from 'react';
import { BoutiqueSettings } from '../../../types';
import { CalendarConnect } from './CalendarConnect';

interface TabCalendarProps {
  settingsForm: BoutiqueSettings;
  setSettingsForm: React.Dispatch<React.SetStateAction<BoutiqueSettings>>;
  handleSaveSettings?: (e?: React.FormEvent) => Promise<void>;
  isSavingSettings?: boolean;
}

export const TabCalendar: React.FC<TabCalendarProps> = ({
  settingsForm,
  setSettingsForm,
  handleSaveSettings,
  isSavingSettings,
}) => {
  return (
    <CalendarConnect
      settingsForm={settingsForm}
      setSettingsForm={setSettingsForm}
      handleSaveSettings={handleSaveSettings}
      isSavingSettings={isSavingSettings}
    />
  );
};
