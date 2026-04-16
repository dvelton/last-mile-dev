import { program } from 'commander';
import { runInit } from './commands/init.js';
import { runSnapshot } from './commands/snapshot.js';
import { runLearn } from './commands/learn.js';
import { runProfile } from './commands/profile-cmd.js';
import { runStatus } from './commands/status.js';
import { runWatch } from './commands/watch.js';
import { runPostCommit } from './commands/post-commit.js';

program
  .name('last-mile-dev')
  .description('Learn coding preferences from the edits you make to AI-generated code')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize last-mile-dev in the current git repository')
  .action(() => runInit());

program
  .command('snapshot')
  .description('Snapshot the current state of AI-generated files')
  .argument('<files...>', 'file paths to snapshot')
  .action((files: string[]) => runSnapshot(files));

program
  .command('learn')
  .description('Analyze edits to snapshotted files and extract coding patterns')
  .option('--apply', 'Save patterns and update the code style profile')
  .action((options) => runLearn(options));

program
  .command('profile')
  .description('Show or export your code style profile')
  .option('--export <format>', 'Export as: copilot-instructions, claude')
  .option('--raw', 'Output raw markdown')
  .option('--reset', 'Reset the profile')
  .action((options) => runProfile(options));

program
  .command('status')
  .description('Show learning statistics and current state')
  .action(() => runStatus());

program
  .command('watch')
  .description('Watch for file changes and auto-snapshot')
  .action(() => runWatch());

program
  .command('_post-commit', { hidden: true })
  .description('Internal: called by git post-commit hook')
  .action(() => runPostCommit());

program.parse();
