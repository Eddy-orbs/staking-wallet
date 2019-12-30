import React, { useCallback, useMemo } from 'react';
import {
  Grid,
  Button,
  Input,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@material-ui/core';
import { useNumber, useStateful } from 'react-hanger';
import styled from 'styled-components';
import { useOrbsAccountStore } from '../../store/storeHooks';
import { WizardContent } from '../../components/wizards/WizardContent';
import { WizardContainer } from '../../components/wizards/WizardContainer';
import { WizardStepper } from '../../components/wizards/WizardStepper';
import { OrbsStakingStepContent } from './OrbsStakingStepContent';
import { TransactionVerificationListener } from '../../transactions/TransactionVerificationListener';
import { TransactionApprovingStepContent } from './TransactionApprovingStepContent';

interface IProps {
  closeWizard(): void;
}

export const StakingWizard: React.FC<IProps> = props => {
  const { closeWizard } = props;
  const orbsAccountStore = useOrbsAccountStore();

  const activeStep = useNumber(0);
  const goToNextStep = useCallback(() => activeStep.increase(), [activeStep]);

  const orbsStakingTx = useStateful<string>('');
  const orbsStakingTxVerificationListener = useStateful<TransactionVerificationListener>(null);
  const onStakingTxSent = useCallback(
    (txHash: string, transactionVerificationListener: TransactionVerificationListener) => {
      orbsStakingTx.setValue(txHash);
      orbsStakingTxVerificationListener.setValue(transactionVerificationListener);
      goToNextStep();
    },
    [orbsStakingTx, orbsStakingTxVerificationListener, goToNextStep],
  );

  const stepContent = useMemo(() => {
    switch (activeStep.value) {
      // Stake orbs
      case 0:
        return <OrbsStakingStepContent onStepFinished={onStakingTxSent} />;

      // Wait for staking tx approval
      case 1:
        return (
          <TransactionApprovingStepContent
            onStepFinished={goToNextStep}
            txHash={orbsStakingTx.value}
            transactionVerificationListener={orbsStakingTxVerificationListener.value}
          />
        );
      // Display success
      case 2:
        return (
          <WizardContent>
            <Typography>Congratulations</Typography>
            <Typography>You have successfully staked Yamba orbs </Typography>
            <Button onClick={goToNextStep}>Select a Guardian</Button>
          </WizardContent>
        );
      // Select a guardian
      case 3:
        return (
          <WizardContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Rank</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell>Selection</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {/* Demo row 1 */}
                  <TableRow>
                    <TableCell>1</TableCell>
                    <TableCell>Douglas Meshuga</TableCell>
                    <TableCell>0xff45223cb</TableCell>
                    <TableCell>
                      <Button onClick={goToNextStep}>Select</Button>
                    </TableCell>
                  </TableRow>

                  {/* Demo row 2 */}
                  <TableRow>
                    <TableCell>2</TableCell>
                    <TableCell>Marina Aliasi</TableCell>
                    <TableCell>0x0343feab</TableCell>
                    <TableCell>
                      <Button onClick={goToNextStep}>Select</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </WizardContent>
        );
      // Wait for guardian selection tx approval
      case 4:
        return (
          <WizardContent>
            <Typography>Approving your transaction</Typography>
            <Typography>
              Link to{' '}
              <a href={'https://etherscan.com'} target={'_blank'} rel={'noopener noreferrer'}>
                Ether Scan
              </a>{' '}
            </Typography>
            <Typography variant={'caption'}>Wait a few seconds... </Typography>
            <Button onClick={goToNextStep}>Proceed</Button>
          </WizardContent>
        );
      case 5:
        return (
          <WizardContent>
            <Typography>Congratulations</Typography>
            <Typography>You have successfully selected a guardian </Typography>
            <Button onClick={() => null}>Finish</Button>
          </WizardContent>
        );
      default:
        throw new Error(`Unsupported step value of ${activeStep.value}`);
    }
  }, [activeStep.value, goToNextStep, onStakingTxSent, orbsStakingTx.value, orbsStakingTxVerificationListener.value]);

  return (
    <WizardContainer data-testid={'wizard_staking'}>
      <WizardStepper activeStep={activeStep.value} alternativeLabel>
        <Step>
          <StepLabel>Staking your tokens</StepLabel>
        </Step>

        <Step>
          <StepLabel>Approving your transaction</StepLabel>
        </Step>

        <Step>
          <StepLabel>Success staking orbs</StepLabel>
        </Step>

        <Step>
          <StepLabel>Select a guardian</StepLabel>
        </Step>

        <Step>
          <StepLabel>Approving your transaction</StepLabel>
        </Step>

        <Step>
          <StepLabel>Success selecting guardian</StepLabel>
        </Step>
      </WizardStepper>

      {stepContent}
    </WizardContainer>
  );
};
