import { Table, TableBody, TableCell, TableHead, TableRow, Paper } from '@material-ui/core';
import { IGuardianInfo } from 'orbs-pos-data';
import * as React from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { TGuardianInfoExtended } from '../store/GuardiansStore';

const asPercent = (num: number) =>
  (num * 100).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + '%';

interface IProps {
  guardians: TGuardianInfoExtended[];
}

export const GuardiansTable = React.memo<IProps>(props => {
  const { t } = useTranslation();
  const sortedGuardians = useMemo(() => props.guardians.slice().sort((a, b) => b.stake - a.stake), [props.guardians]);

  return (
    <Paper>
      <Table data-testid={'guardians-table'}>
        <TableHead>
          <TableRow>
            <TableCell>{t('Name')}</TableCell>
            <TableCell>{t('Address')}</TableCell>
            <TableCell>{t('Url')}</TableCell>
            <TableCell>{t('Stake')}</TableCell>
            <TableCell>{t('Voted')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortedGuardians.map((g, idx) => (
            <TableRow data-testid={`guardian-${idx + 1}`} key={g.name} hover>
              <TableCell data-testid={`guardian-${idx + 1}-name`}>
                <Jazzicon diameter={40} seed={jsNumberForAddress(g.address)} />
                {g.name}
              </TableCell>
              <TableCell data-testid={`guardian-${idx + 1}-address`}>{g.address}</TableCell>
              <TableCell data-testid={`guardian-${idx + 1}-website`}>{g.website}</TableCell>
              <TableCell data-testid={`guardian-${idx + 1}-stake`}>{asPercent(g.stake)}</TableCell>
              <TableCell data-testid={`guardian-${idx + 1}-voted`}>{g.voted ? 'Yes' : 'No'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
});
