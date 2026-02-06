import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get current year
        const year = new Date().getFullYear();
        const yearPrefix = `J-${year}-`;
        const currentCompany = user.current_company || user.company;
        
        // Retry logic to handle race conditions
        const maxRetries = 5;
        let attempt = 0;
        let jobNumber;
        
        while (attempt < maxRetries) {
            try {
                // Get or create sequence record for this year and company
                const sequences = await base44.asServiceRole.entities.JobSequence.filter({
                    year: year,
                    service_company: currentCompany
                });
                
                let sequence;
                let nextNumber;
                
                if (sequences.length === 0) {
                    // First job of the year - create sequence
                    sequence = await base44.asServiceRole.entities.JobSequence.create({
                        year: year,
                        last_number: 1,
                        service_company: currentCompany
                    });
                    nextNumber = 1;
                } else {
                    // Increment existing sequence
                    sequence = sequences[0];
                    nextNumber = (sequence.last_number || 0) + 1;
                    
                    // Update with optimistic concurrency check
                    await base44.asServiceRole.entities.JobSequence.update(sequence.id, {
                        last_number: nextNumber
                    });
                }
                
                // Format as J-YYYY-###
                jobNumber = `${yearPrefix}${String(nextNumber).padStart(3, '0')}`;
                
                // Verify uniqueness (safety check)
                const existing = await base44.asServiceRole.entities.Job.filter({
                    job_number: jobNumber
                });
                
                if (existing.length === 0) {
                    // Success - unique number generated
                    break;
                }
                
                // Collision detected - retry
                attempt++;
                if (attempt >= maxRetries) {
                    throw new Error('Failed to generate unique job number after retries');
                }
                
                // Small delay before retry
                await new Promise(resolve => setTimeout(resolve, 100 * attempt));
                
            } catch (error) {
                attempt++;
                if (attempt >= maxRetries) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            }
        }
        
        return Response.json({ job_number: jobNumber });
        
    } catch (error) {
        console.error('Error generating job number:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});